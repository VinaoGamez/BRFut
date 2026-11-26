# Transparência dos assets da interface

## Causa

O conversor `scripts/optimize-assets.py` usava `convert("RGB")` em todos os PNGs.
Isso descartava o canal alfa e revelava a cor RGB escondida sob a transparência:
magenta nos ícones de estatísticas e fundos indevidos em outros elementos.

Foram identificados 18 WebPs que perderam transparência em relação aos PNGs
originais do histórico. As imagens foram recuperadas do commit
`3f433db8a1e3df1cf3cfae0434be0e28e481feaf`, mantendo as dimensões em uso.
Incluem ícones do dashboard, marcas, troféu, marcadores da partida, setas e
arte do mercado. O master WebP do troféu também foi corrigido.

## Tratamentos

- Os 18 arquivos voltaram a RGBA, a partir do PNG original, não de uma tentativa
  de separar o fundo na imagem WebP já comprimida.
- Oito ícones auditados tinham resíduos da antiga cor-chave magenta perto do
  recorte original. A limpeza se limita a essa faixa de borda; detalhes roxos
  no interior não são removidos. O redimensionamento posterior cria antialias.
- `assets/ui/assist-boot.webp` era uma arte monocromática com canvas branco
  opaco desde a origem. O branco foi convertido em espaço negativo/alfa,
  preservando a apresentação pelo filtro de inversão que já existia no CSS.
- São 19 arquivos corrigidos. Banners, cards e QR code não foram convertidos
  indiscriminadamente em imagens transparentes.
- RGBA e transparência de paleta agora são preservados pelo otimizador. Assets
  transparentes usam WebP lossless; imagens opacas mantêm a otimização anterior.

Nenhum CSS de mistura ou fundo fixo foi usado para esconder o problema.
O asset deve compor diretamente sobre o fundo da interface.

## Reproduzir e verificar

```text
py scripts/restore-asset-transparency.py
py scripts/restore-asset-transparency.py --apply
py scripts/asset-transparency-tests.py
npm run test:all
npm run desktop:dist
```

A restauração depende do histórico Git local e Pillow, não de rede. O comando
sem `--apply` apenas audita. Os testes não precisam acessar o histórico: usam
o manifesto de máscaras auditadas em `scripts/asset-transparency-manifest.json`.
O manifesto registra origem, dimensões, tratamento e SHA256 do canal alfa.

As regressões cobrem as 19 máscaras, composição sobre três fundos, RGBA,
redimensionamento com bordas semitransparentes, paleta, arte opaca, ícone
monocromático e preservação das cores internas durante limpeza das bordas.

`modules/ao-vivo-2d` permanece intocado. Saves e dados de carreira não mudam.
