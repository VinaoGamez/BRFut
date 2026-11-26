"""
Enxuga o payload de imagens antes do empacotamento.

Por que WebP e não reduzir: o painel do card de gerente tem `width: min(510px)`
e `aspect-ratio: 3/4`, ou seja 510x680 px. O arquivo tem 1024x1536 — um asset
2x, do tamanho certo. O problema nao e dimensao, e PNG: 2,2 MB por imagem para
algo que so precisa de nitidez em tela retina.

Onde o redimensionamento realmente importa: os icones de estatistica
(`brand/stats-*.png`) sao renderizados com `width="58" height="58"`, e o arquivo
tem 1024x1024 — 17x maior do que a tela usa.

O que este script faz:
  1. Converte PNG grande para WebP, mantendo a resolucao.
  2. Reduz para o tamanho de exibicao quando ele for muito menor que o arquivo.
  3. Apaga o PNG quando o WebP substituiu, e atualiza as referencias no codigo.

Os originais ficam no historico do git.

Uso:
  python scripts/optimize-assets.py            # mostra o plano
  python scripts/optimize-assets.py --apply    # executa
"""
import argparse
import os
import re
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow nao encontrado: python -m pip install Pillow")

RAIZ = Path(__file__).resolve().parent.parent
PUBLIC = RAIZ / "public"
ASSETS = RAIZ / "assets"

# Formato: caminho -> (largura maxima, altura maxima, qualidade webp, motivo)
# `None` na dimensao significa "manter".
REGRAS = {
    # Card de gerente: 510x680 na tela. 1024x1536 e o asset 2x correto.
    "public/manager-cards": (1024, 1536, 82, "card 2x de 510x680"),
    # Icones de 58px: 256 ainda e 4x, e sobra para retina.
    "public/brand/stats-scorer.png": (256, 256, 88, "icone de 58px"),
    "public/brand/stats-assist.png": (256, 256, 88, "icone de 58px"),
    "public/brand/stats-overall.png": (256, 256, 88, "icone de 58px, sem uso no jogo"),
    # Marca grande da home.
    "public/brand/home-stadium.png": (1280, 720, 84, "banner da home"),
    "public/brand/lockup-lg.png": (1470, 220, 88, "lockup grande"),
    "public/brand/lockup.png": (1069, 160, 88, "lockup"),
    "public/brand/mark-lg.png": (512, 512, 90, "icone do app"),
    "public/brand/mark.png": (512, 512, 90, "icone"),
    "public/brand/support-qrcode.png": (400, 400, 90, "QR code"),
    "public/brand/transfer-coins.png": (256, 256, 88, "icone"),
    # Escudo grande do mercado: 1920x1920 para uma imagem pequena na tela.
    "brand/transfer-history/mercado-da-bola.png": (960, 960, 84, "1920x1920 exibido pequeno"),
    # Cards de jogador: 682x1024, exibidos na tela de elenco e no card de
    # partida. São ~79 PNGs de 180 KB importados estaticamente pelos
    # `js/lab/card-*-variants.js` — que nao e codigo de laboratorio, e o
    # `js/engine/player-card-art.js` importa dele. Só o formato é caro.
    "assets/cards": (682, 1024, 85, "card 682x1024"),
    # Icones da interface.
    "assets/ui": (256, 256, 88, "icone de UI"),
}

# Abaixo disto nao vale converter: o ganho nao paga o risco.
LIMITE_MINIMO = 12 * 1024
# Acima disto e grande demais para ignorar.
LIMITE_INTERESSE = 40 * 1024
# Rede de seguranca para PNG sem regra especifica. 24 KB e folgado: um PNG de
LIMITE_REDE = 24 * 1024


def tamanho(p):
    return p.stat().st_size if p.exists() else 0


# Origem do pipeline de arte. São os masters de onde o WebP é derivado; não
# devem virar WebP, senão a próxima geração reprocessa arquivo já processado.
IGNORAR_PASTAS = {"source"}

# Rede de segurança: qualquer PNG acima disto, em qualquer pasta, vira WebP
# sem redimensionar. Cobre os que sobraram (bandeiras de transmissão, escudos,
# ilustrações da home) sem precisar listar um a um.
PADRAO_PADRAO = (None, None, 84, "PNG grande sem regra especifica")


def coletar():
    """Devolve [(png, regra)] para os arquivos que interessam."""
    alvos = []
    cobertos = set()
    for chave, regra in REGRAS.items():
        p = RAIZ / chave
        if p.is_dir():
            # Recursivo: `assets/cards/` tem uma subpasta por posição (goleiro/,
            # lateral/, mei/...) e `glob` não desce nelas.
            alvos.extend((f, regra) for f in sorted(p.rglob("*.png")))
            cobertos.add(p.resolve())
        elif p.exists() and p.suffix.lower() == ".png":
            alvos.append((p, regra))
            cobertos.add(p.resolve())

    # O que não caiu em nenhuma regra, mas é grande o bastante para importar.
    for base in (PUBLIC, ASSETS):
        if not base.exists():
            continue
        for f in sorted(base.rglob("*.png")):
            resolvido = f.resolve()
            if resolvido in cobertos:
                continue
            if any(resolvido.is_relative_to(c) for c in cobertos):
                continue
            if any(parte in IGNORAR_PASTAS for parte in f.parts):
                continue
            if tamanho(f) >= LIMITE_REDE:
                alvos.append((f, PADRAO_PADRAO))
    return alvos


def estimar(p, larg_max, alt_max, qualidade):
    with Image.open(p) as img:
        origem = img.size
        if larg_max is None or alt_max is None:
            alvo = origem
        else:
            alvo = (min(origem[0], larg_max), min(origem[1], alt_max))
        # WebP costuma ficar entre 8% e 25% do PNG, conforme a complexityidade.
        razao = (alvo[0] * alvo[1]) / (origem[0] * origem[1])
        fator = 0.10 if razao >= 0.9 else 0.18
        estimado = max(6000, tamanho(p) * fator)
    return origem, alvo, estimado


def aplicar(p, larg_max, alt_max, qualidade):
    destino = p.with_suffix(".webp")
    with Image.open(p) as img:
        # Discarding A exposes the hidden RGB matte (magenta/black) behind icons.
        # Palette PNGs may carry transparency without an explicit alpha band.
        transparente = "A" in img.getbands() or "transparency" in img.info
        img = img.convert("RGBA" if transparente else "RGB")
        if larg_max is not None and alt_max is not None:
            img = img.resize(
                (min(img.width, larg_max), min(img.height, alt_max)),
                Image.LANCZOS,
            )
        # Lossless RGBA keeps both antialiased edges and alpha intact. Opaque
        # artwork retains the existing lossy optimization.
        img.save(destino, "WEBP", quality=qualidade, method=6, lossless=transparente)
    return destino


def atualizar_referencias(antigos, novos):
    """Troca as referencias .png por .webp nos fontes do projeto.

    Só varre `js/`, `css/` e os HTML da raiz. Um rglob indiscriminado na raiz
    já chegou em `modules/ao-vivo-2d`, que é duplicação intencional com
    DO-NOT-EDIT.md.
    """
    alvos = []
    # Recursivo dentro de js/ e css/: as referências vivem em feature/..., lab/...
    for pasta in ("js", "css"):
        base = RAIZ / pasta
        if base.exists():
            alvos.extend(base.rglob("*.js"))
            alvos.extend(base.rglob("*.css"))
    # HTML apenas na raiz do projeto.
    alvos.extend(sorted(RAIZ.glob("*.html")))
    mudancas = []
    for arquivo in alvos:
        try:
            texto = arquivo.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        original = texto
        for velho, novo in zip(antigos, novos):
            texto = texto.replace(velho, novo)
            texto = texto.replace(velho.replace("\\", "/"), novo.replace("\\", "/"))
        if texto != original:
            arquivo.write_text(texto, encoding="utf-8")
            mudancas.append(arquivo.relative_to(RAIZ).as_posix())
    return mudancas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="escreve as conversoes")
    ap.add_argument("--refs-only", action="store_true", help="so reescreve referencias .png -> .webp")
    args = ap.parse_args()

    if args.refs_only:
        pares = [(f"{n}.png", f"{n}.webp") for n in sorted({p.stem for p in (PUBLIC / "manager-cards").glob("*.webp")} | {p.stem for p in (PUBLIC / "brand").glob("*.webp")})]
        mudancas = atualizar_referencias([a for a, _ in pares], [b for _, b in pares])
        print("referencias atualizadas em:")
        for m in mudancas:
            print(f"  {m}")
        if not mudancas:
            print("  (nenhuma)")
        return

    alvos = coletar()
    if not alvos:
        print("nada a fazer")
        return

    antes = sum(tamanho(p) for p, _ in alvos)
    plano = []
    for p, (larg, alt, qual, motivo) in alvos:
        if tamanho(p) < LIMITE_MINIMO:
            continue
        origem, alvo, estimado = estimar(p, larg, alt, qual)
        plano.append((p, origem, alvo, motivo, estimado))

    print(f"{'arquivo':<44} {'de':>12} {'para':>12} {'motivo'}")
    for p, origem, alvo, motivo, _ in plano:
        nome = p.relative_to(RAIZ).as_posix()
        print(f"{nome:<44} {str(origem):>12} {str(alvo):>12} {motivo}")

    depois = sum(e for *_, e in plano)
    print(f"\nplanejado: {antes/1048576:.1f} MB -> {depois/1048576:.1f} MB")

    if not args.apply:
        print("\n(dry-run; rode com --apply para escrever)")
        return

    antigos, novos = [], []
    for p, origem, alvo, motivo, _ in plano:
        chave = p.relative_to(RAIZ).as_posix()
        pasta_regra = next(
            (k for k in REGRAS if p.is_relative_to(RAIZ / k)), None
        )
        if pasta_regra is None:
            pasta_regra = chave
        regra = REGRAS.get(pasta_regra, PADRAO_PADRAO)
        destino = aplicar(p, *regra[:3])
        antigos.append(p.name)
        novos.append(destino.name)
        p.unlink()
        print(f"  {chave} -> {destino.name} ({tamanho(destino)/1024:.0f} KB)")

    mudancas = atualizar_referencias(antigos, novos)
    if mudancas:
        print("\nreferencias atualizadas em:")
        for m in mudancas:
            print(f"  {m}")


if __name__ == "__main__":
    main()
