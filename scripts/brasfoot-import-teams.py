#!/usr/bin/env python3
"""
Extrai clubes do Brasfoot: Estado, Time (sem copiar escudos PNG).

Uso:
  py scripts/brasfoot-import-teams.py "C:\\Users\\...\\Brasfoot22-23"
  py scripts/brasfoot-import-teams.py --merge "C:\\...\\Brasfoot22-23" "C:\\...\\3 PC 15 Brasfoot"

Saída:
  public/data/brasfoot-clubs-import.json  — importar no Team Lab (escudo gerado ou upload manual)
"""

from __future__ import annotations

import json
import os
import re
import shutil
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

try:
    import javaobj
except ImportError:
    print("Instale: pip install javaobj-py3")
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_JS = ROOT / "js" / "engine" / "brazilian-clubs-by-uf.js"
OUT_JSON = ROOT / "public" / "data" / "brasfoot-clubs-import.json"
OUT_MANIFEST = ROOT / "public" / "data" / "brasfoot-crests-manifest.json"
OUT_CREST_DIR = ROOT / "public" / "clubs" / "brasfoot"

UFS = (
    "ac", "al", "am", "ap", "ba", "ce", "df", "es", "go", "ma", "mg", "ms", "mt",
    "pa", "pb", "pe", "pi", "pr", "rj", "rn", "ro", "rr", "rs", "sc", "se", "sp", "to",
)
UF_SET = set(UFS)

# Clubes grandes cujo slug não traz UF (Brasfoot _bra sem sufixo estadual).
MANUAL_UF = {
    "corinthians": "SP",
    "palmeiras": "SP",
    "santos": "SP",
    "saopaulo": "SP",
    "ponte preta": "SP",
    "guarani": "SP",
    "flamengo": "RJ",
    "fluminense": "RJ",
    "vasco": "RJ",
    "botafogo": "RJ",
    "gremio": "RS",
    "internacional": "RS",
    "cruzeiro": "MG",
    "atletico mineiro": "MG",
    "atletico-mg": "MG",
    "atletico-mineiro": "MG",
    "atletico goianiense": "GO",
    "bahia": "BA",
    "vitoria": "BA",
    "fortaleza": "CE",
    "ceara": "CE",
    "sport": "PE",
    "nautico": "PE",
    "santa cruz": "PE",
    "athletico paranaense": "PR",
    "athletico pr": "PR",
    "coritiba": "PR",
    "parana": "PR",
    "juventude": "RS",
    "avai": "SC",
    "figueirense": "SC",
    "chapecoense": "SC",
    "cuiaba": "MT",
    "operario": "MS",
    "aguia negra": "MS",
    "remo": "PA",
    "paysandu": "PA",
    "goias": "GO",
    "vila nova": "GO",
    "america mineiro": "MG",
    "tombense": "MG",
    "abecat ouvidorense": "GO",
    "ceilandia": "DF",
    "joinville": "SC",
    "caxias": "RS",
    "capixaba": "ES",
    "floresta": "CE",
    "humaita": "AC",
    "maringa": "PR",
    "murici": "AL",
    "porto velho": "RO",
    "tocantinopolis": "TO",
    "botafogo sp": "SP",
    "botafogo-sp": "SP",
    "aguiapa": "PA",
    "aguia de maraba": "PA",
    "atletico cearense": "CE",
    "atletico-ce": "CE",
    "portuguesa rj": "RJ",
    "portuguesa-rj": "RJ",
    "novo hamburgo": "RS",
    "concordia": "SC",
    "hercilio luz": "SC",
    "america-rn": "RN",
    "atletico-pi": "PI",
    "santa cruz-rn": "RN",
    "laguna": "SC",
    "cacerense": "MT",
}

# Slugs sem sufixo _bra que são estrangeiros europeus (evita falso positivo).
FOREIGN_SLUGS = frozenset(
    {
        "arsenal",
        "chelsea",
        "fulham",
        "lyon",
        "porto",
        "sunderland",
        "barcelona",
        "real",
        "milan",
        "juventus",
    }
)

# Sufixo Brasfoot → país CONMEBOL (Libertadores / Sul-Americana).
CONMEBOL_SUFFIX = {
    "arg": "ARG",
    "ar": "ARG",
    "bol": "BOL",
    "chi": "CHI",
    "col": "COL",
    "equ": "ECU",
    "par": "PAR",
    "per": "PER",
    "uru": "URU",
    "ven": "VEN",
}

# Sufixo no .ban que indica clube BR mas não é UF (ex.: uberlandia_ec = Esporte Clube).
BRA_FILE_MARKERS = frozenset({"ec"})

FOREIGN_CLUB_UF = {
    "ARG": "AR",
    "BOL": "BL",
    "CHI": "CL",
    "COL": "CO",
    "ECU": "EC",
    "PAR": "PG",
    "PER": "PU",
    "URU": "UY",
    "VEN": "VN",
}


def norm_name(value: str) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", text.strip().lower())


def clean_key(value: str) -> str:
    s = str(value or "").lower()
    for suf in ("_bra", "_br", "_sp", ".ban"):
        if s.endswith(suf):
            s = s[: -len(suf)]
    return s.replace("_", "")


def load_registry_map() -> dict[str, str]:
    text = REGISTRY_JS.read_text(encoding="utf-8")
    out: dict[str, str] = {}
    for name, uf in re.findall(r"\{ name: '([^']+)', uf: '([A-Z]{2})'", text):
        out[norm_name(name)] = uf
    return out


def load_registry_clubs() -> dict[str, dict]:
    """Chave UF|nome normalizado -> clube canônico do Matchday (com divisão)."""
    text = REGISTRY_JS.read_text(encoding="utf-8")
    out: dict[str, dict] = {}
    for name, uf, division in re.findall(
        r"\{ name: '([^']+)', uf: '([A-Z]{2})', division: '([A-Z]+|REG)'",
        text,
    ):
        key = f"{uf}|{registry_name_key(name)}"
        out[key] = {"name": name, "uf": uf, "division": division}
    return out


def registry_name_key(name: str) -> str:
    text = norm_name(name)
    text = re.sub(r"\s*\([^)]*\)\s*$", "", text)
    text = re.sub(r"\s*-\s*[a-z]{2}\s*$", "", text)
    return re.sub(r"\s+", " ", text).strip()


# Slugs Brasfoot sem sufixo estadual → clube canônico na pirâmide.
SLUG_CANONICAL = {
    "flarj": ("Flamengo", "RJ"),
    "flurj": ("Fluminense", "RJ"),
    "botafogorj_bra": ("Botafogo", "RJ"),
    "vasco": ("Vasco", "RJ"),
    "palmeiras": ("Palmeiras", "SP"),
    "saopaulo_bra": ("São Paulo", "SP"),
    "corinthians_bra": ("Corinthians", "SP"),
    "santos": ("Santos", "SP"),
    "pontepreta_bra": ("Ponte Preta", "SP"),
    "guaranisp_bra": ("Guarani", "SP"),
    "gremio": ("Grêmio", "RS"),
    "internacional_bra": ("Internacional", "RS"),
    "cruzeiro_bra": ("Cruzeiro", "MG"),
    "atleticomg_bra": ("Atlético-MG", "MG"),
    "americamg_bra": ("América-MG", "MG"),
    "bahia_bra": ("Bahia", "BA"),
    "vitoria_bra": ("Vitória", "BA"),
    "sport": ("Sport", "PE"),
    "fortaleza_bra": ("Fortaleza", "CE"),
    "ceara_bra": ("Ceará", "CE"),
    "athleticopr_bra": ("Athletico PR", "PR"),
    "coritiba_bra": ("Coritiba", "PR"),
    "chapecoense_bra": ("Chapecoense", "SC"),
    "avai_bra": ("Avai", "SC"),
    "goias_bra": ("Goiás", "GO"),
    "bragantino_bra": ("Bragantino", "SP"),
    "nautico_bra": ("Náutico", "PE"),
    "santacruz_bra": ("Santa Cruz", "PE"),
    "juventude_bra": ("Juventude", "RS"),
    "criciuma_bra": ("Criciúma", "SC"),
    "figueirense_bra": ("Figueirense", "SC"),
    "joinville_bra": ("Joinville", "SC"),
    "londrina_bra": ("Londrina", "PR"),
    "remo_bra": ("Remo", "PA"),
    "paysandu_bra": ("Paysandu", "PA"),
    "vilanova_bra": ("Villa Nova", "MG"),
    "botafogosp_bra": ("Botafogo-SP", "SP"),
    "aguiapa_bra": ("Águia de Marabá", "PA"),
    "atleticoce_bra": ("Atlético-CE", "CE"),
    "portuguesarj_bra": ("Portuguesa-RJ", "RJ"),
    "novohamburgo_bra": ("Novo Hamburgo", "RS"),
    "concordiasc_bra": ("Concórdia", "SC"),
    "hercilioluzsc_bra": ("Hercílio Luz", "SC"),
}


def apply_registry_division(entry: dict, registry_clubs: dict[str, dict]) -> None:
    crest = entry.get("crest") or {}
    slug = str(crest.get("slug") or "")
    uf = str(entry.get("uf") or "").upper()

    canonical = SLUG_CANONICAL.get(slug)
    if canonical:
        entry["name"], entry["uf"] = canonical
        uf = entry["uf"]

    key = f"{uf}|{registry_name_key(entry.get('name', ''))}"
    match = registry_clubs.get(key)
    if match:
        entry["name"] = match["name"]
        entry["uf"] = match["uf"]
        entry["division"] = match["division"]
        entry["registryMatch"] = True
        return

    entry.setdefault("division", "REG")


def file_suffix(fname: str) -> str:
    base = fname[:-4].lower()
    if "_" not in base:
        return ""
    return base.rsplit("_", 1)[-1]


def is_foreign_file_suffix(suffix: str) -> bool:
    if not suffix:
        return False
    if suffix in CONMEBOL_SUFFIX:
        return True
    if suffix in UF_SET or suffix in ("bra", "br") or suffix in BRA_FILE_MARKERS:
        return False
    return True


def match_registry_uf(name: str, registry: dict[str, str]) -> str | None:
    n = norm_name(name)
    if n in registry:
        return registry[n]
    if n in MANUAL_UF:
        return MANUAL_UF[n]
    for rname, uf in registry.items():
        if len(rname) >= 4 and (rname in n or n in rname):
            return uf
    return None


def resolve_brazil_uf(fname: str, slug: str, name: str, registry: dict[str, str]) -> tuple[str | None, str]:
    """UF brasileira — sufixo explícito do .ban/slug Brasfoot (sem token parcial esp≠SP)."""
    base = fname[:-4].lower()
    suffix = file_suffix(fname)
    slug_low = str(slug or "").lower()

    canonical = SLUG_CANONICAL.get(slug_low)
    if canonical:
        return canonical[1], "slug_canonical"

    if suffix in UF_SET:
        return suffix.upper(), "file_suffix"

    if suffix in ("bra", "br"):
        stem = base[: -(len(suffix) + 1)]
        canonical = SLUG_CANONICAL.get(f"{stem}_{suffix}")
        if canonical:
            return canonical[1], "slug_canonical"

        matched = match_registry_uf(name, registry)
        if matched:
            return matched, "registry"

        for uf in UFS:
            if stem.endswith(f"_{uf}"):
                return uf.upper(), "bra+stem_uf"

        if "_" in stem:
            maybe = stem.rsplit("_", 1)[-1]
            if maybe in UF_SET:
                return maybe.upper(), "bra+uf"

    matched = match_registry_uf(name, registry)
    if matched:
        return matched, "registry"

    for uf in UFS:
        if slug_low.endswith(f"_{uf}"):
            return uf.upper(), "slug_uf"

    m = re.search(r"-\s*([A-Z]{2})\s*$", name)
    if m and m.group(1).lower() in UF_SET:
        return m.group(1).upper(), "name"

    return None, "unknown"


def classify_brasfoot_team(fname: str, slug: str, name: str, registry: dict[str, str]) -> dict | None:
    """Classifica pelo sufixo final do .ban (padrão Brasfoot). None = clube fora do escopo."""
    base = fname[:-4].lower()
    suffix = file_suffix(fname)

    if clean_key(slug or base) in FOREIGN_SLUGS:
        return None

    if suffix in CONMEBOL_SUFFIX:
        country = CONMEBOL_SUFFIX[suffix]
        return {
            "country": country,
            "uf": FOREIGN_CLUB_UF[country],
            "source": "conmebol_suffix",
        }

    if suffix in BRA_FILE_MARKERS:
        uf, source = resolve_brazil_uf(fname, slug, name, registry)
        if not uf:
            return None
        return {"country": "BRA", "uf": uf, "source": f"marker_{suffix}+{source}"}

    if suffix in UF_SET:
        return {"country": "BRA", "uf": suffix.upper(), "source": "uf_suffix"}

    if suffix in ("bra", "br"):
        uf, source = resolve_brazil_uf(fname, slug, name, registry)
        if not uf:
            return {"country": "BRA", "uf": "SP", "source": "bra_fallback", "needsReview": True}
        return {"country": "BRA", "uf": uf, "source": f"bra_suffix+{source}"}

    if is_foreign_file_suffix(suffix):
        return None

    if "_" not in base:
        uf, source = resolve_brazil_uf(fname, slug, name, registry)
        if uf:
            return {"country": "BRA", "uf": uf, "source": f"plain+{source}"}
        n = norm_name(name)
        if n in registry or n in MANUAL_UF:
            uf = registry.get(n) or MANUAL_UF.get(n)
            return {"country": "BRA", "uf": uf, "source": "plain+name"}
        return None

    return None


def resolve_uf(fname: str, slug: str, name: str, registry: dict[str, str]) -> tuple[str | None, str]:
    """Compat — preferir classify_brasfoot_team()."""
    return resolve_brazil_uf(fname, slug, name, registry)


def is_brazilian_candidate(fname: str, slug: str) -> bool:
    return classify_brasfoot_team(fname, slug, "", load_registry_map()) is not None


def reset_crest_dir() -> int:
    OUT_CREST_DIR.mkdir(parents=True, exist_ok=True)
    removed = 0
    for old in OUT_CREST_DIR.glob("*.png"):
        old.unlink(missing_ok=True)
        removed += 1
    return removed


def jstr(value) -> str:
    return "" if value is None else str(value)


def write_crest_manifest(generated_at: str | None = None) -> int:
    OUT_CREST_DIR.mkdir(parents=True, exist_ok=True)
    images = sorted(f"brasfoot/{path.name}" for path in OUT_CREST_DIR.glob("*.png") if path.is_file())
    payload = {
        "generatedAt": generated_at or datetime.now(timezone.utc).isoformat(),
        "count": len(images),
        "images": images,
    }
    OUT_MANIFEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(images)


def entry_score(entry: dict) -> tuple:
    crest = entry.get("crest") or {}
    needs_review = 0 if not entry.get("needsReview") else -1
    div_rank = {"A": 4, "B": 3, "C": 2, "D": 1, "REG": 0}.get(str(entry.get("division") or "REG"), 0)
    slug = str(crest.get("slug") or "")
    uf = str(entry.get("uf") or "").lower()
    slug_bonus = 1 if "_bra" in slug or slug.endswith(f"_{uf}") else 0
    registry_bonus = 1 if entry.get("registryMatch") else 0
    return (needs_review, registry_bonus, div_rank, slug_bonus, -len(str(entry.get("name") or "")))


def pick_best_entry(a: dict, b: dict) -> dict:
    return a if entry_score(a) >= entry_score(b) else b


def copy_crest_file(crest_src: Path, slug: str) -> str | None:
    if not crest_src.is_file() or not slug:
        return None
    dest_name = f"{slug}.png"
    dest = OUT_CREST_DIR / dest_name
    shutil.copy2(crest_src, dest)
    return f"brasfoot/{dest_name}"


class MergeState:
    def __init__(self) -> None:
        self.clubs: list[dict] = []
        self.unknown: list[dict] = []
        self.by_id: dict[str, dict] = {}
        self.slug_to_id: dict[str, str] = {}
        self.clean_slug_to_id: dict[str, str] = {}
        self.name_uf_to_id: dict[str, str] = {}
        self.copied = 0
        self.skipped_foreign = 0
        self.skipped_duplicate = 0

    def _keys(self, entry: dict) -> tuple[str, str, str]:
        crest = entry.get("crest") or {}
        slug = str(crest.get("slug") or "")
        country = str(entry.get("country") or "BRA").upper()
        uf = str(entry.get("uf") or "").upper()
        if country != "BRA":
            name_uf = f"{country}|{norm_name(entry.get('name', ''))}"
        else:
            name_uf = f"{uf}|{norm_name(entry.get('name', ''))}"
        return slug, clean_key(slug), name_uf

    def _find_existing_id(self, entry: dict) -> str | None:
        slug, clean_slug, name_uf = self._keys(entry)
        for key, bucket in (
            (slug, self.slug_to_id),
            (clean_slug, self.clean_slug_to_id),
            (name_uf, self.name_uf_to_id),
        ):
            if key and key in bucket:
                return bucket[key]
        return None

    def _register(self, entry: dict) -> None:
        entry_id = entry["id"]
        self.by_id[entry_id] = entry
        slug, clean_slug, name_uf = self._keys(entry)
        if slug:
            self.slug_to_id[slug] = entry_id
        if clean_slug:
            self.clean_slug_to_id[clean_slug] = entry_id
        if name_uf:
            self.name_uf_to_id[name_uf] = entry_id

    def _unregister(self, entry: dict) -> None:
        entry_id = entry["id"]
        self.by_id.pop(entry_id, None)
        slug, clean_slug, name_uf = self._keys(entry)
        if slug and self.slug_to_id.get(slug) == entry_id:
            self.slug_to_id.pop(slug, None)
        if clean_slug and self.clean_slug_to_id.get(clean_slug) == entry_id:
            self.clean_slug_to_id.pop(clean_slug, None)
        if name_uf and self.name_uf_to_id.get(name_uf) == entry_id:
            self.name_uf_to_id.pop(name_uf, None)

    def add(self, entry: dict, crest_src: Path | None = None) -> None:
        crest = entry.setdefault("crest", {})
        crest.pop("image", None)
        slug = str(crest.get("slug") or "")

        entry["id"] = f"brasfoot-{slug or norm_name(entry.get('name', '')).replace(' ', '-')}"
        existing_id = self._find_existing_id(entry)
        if existing_id:
            existing = self.by_id[existing_id]
            merged = pick_best_entry(existing, entry)
            merged_slug = str((merged.get("crest") or {}).get("slug") or existing_id.removeprefix("brasfoot-"))
            merged_id = f"brasfoot-{merged_slug}"
            merged["id"] = merged_id

            self._unregister(existing)
            self.clubs = [item for item in self.clubs if item["id"] != existing_id]
            self.unknown = [item for item in self.unknown if item["id"] != existing_id]
            if merged.get("needsReview"):
                self.unknown.append(merged)
            else:
                self.clubs.append(merged)
            self._register(merged)
            self.skipped_duplicate += 1
            return

        if entry.get("needsReview"):
            self.unknown.append(entry)
        else:
            self.clubs.append(entry)
        self._register(entry)


def import_brasfoot_path(brasfoot: Path, registry: dict[str, str], registry_clubs: dict[str, dict], state: MergeState) -> None:
    teams_dir = brasfoot / "teams"
    esc_dir = teams_dir / "escudos"
    if not teams_dir.is_dir():
        print(f"Pasta não encontrada: {teams_dir}")
        return

    seen_names: set[str] = set()
    for path in sorted(teams_dir.glob("*.ban")):
        fname = path.name

        try:
            with path.open("rb") as handle:
                team = javaobj.load(handle)
        except Exception as exc:  # noqa: BLE001
            print(f"skip {fname}: {exc}")
            continue

        slug = jstr(getattr(team, "d", "")).strip()
        name = jstr(getattr(team, "e", "")).strip()
        if not name:
            continue

        if clean_key(slug) in FOREIGN_SLUGS:
            state.skipped_foreign += 1
            continue

        locale = classify_brasfoot_team(fname, slug, name, registry)
        if not locale:
            state.skipped_foreign += 1
            continue

        country = locale["country"]
        uf = locale["uf"]
        source = locale["source"]

        crest_src = esc_dir / f"{slug}.png"
        if not crest_src.is_file():
            crest_src = esc_dir / f"{fname[:-4]}.png"

        entry = {
            "name": name,
            "country": country,
            "uf": uf,
            "division": "A" if country != "BRA" else "REG",
            "crest": {
                "slug": slug or norm_name(name).replace(" ", "-"),
                "primary": jstr(getattr(team, "cor1", "#1a3fa8")) or "#1a3fa8",
                "secondary": jstr(getattr(team, "cor2", "#ffffff")) or "#ffffff",
                "accent": jstr(getattr(team, "cor2", "#ffffff")) or "#ffffff",
                "pattern": "solid",
            },
            "brasfoot": {
                "file": fname,
                "slug": slug,
                "ufSource": source,
                "pack": str(brasfoot),
            },
        }

        name_key = norm_name(name)
        if name_key in seen_names:
            disambig = uf if country == "BRA" else country
            entry["name"] = f"{name} ({disambig})"
        seen_names.add(norm_name(entry["name"]))

        if country == "BRA":
            apply_registry_division(entry, registry_clubs)
            if locale.get("needsReview"):
                entry["needsReview"] = True
        state.add(entry, crest_src if crest_src.is_file() else None)


def main() -> int:
    args = sys.argv[1:]
    merge_mode = False
    if not args:
        print(__doc__)
        return 1
    if args[0] == "--merge":
        merge_mode = True
        args = args[1:]
    if not args:
        print(__doc__)
        return 1

    paths = [Path(arg) for arg in args]
    registry = load_registry_map()
    registry_clubs = load_registry_clubs()
    removed_crests = reset_crest_dir()
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)

    state = MergeState()
    for brasfoot in paths:
        print(f"Importando: {brasfoot}")
        import_brasfoot_path(brasfoot, registry, registry_clubs, state)

    now = datetime.now(timezone.utc).isoformat()
    for entry in state.clubs + state.unknown:
        entry["createdAt"] = now
        entry["updatedAt"] = now

    payload = {
        "source": "brasfoot-merge" if merge_mode or len(paths) > 1 else "brasfoot-single",
        "generatedAt": now,
        "brasfootPaths": [str(path) for path in paths],
        "stats": {
            "clubs": len(state.clubs),
            "unknown": len(state.unknown),
            "crestsCopied": state.copied,
            "crestsRemoved": removed_crests,
            "skippedForeign": state.skipped_foreign,
            "skippedDuplicate": state.skipped_duplicate,
        },
        "clubs": state.clubs + state.unknown,
    }

    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    manifest_count = write_crest_manifest(now)

    dedupe_script = ROOT / "scripts" / "dedupe-brasfoot-clubs.py"
    if dedupe_script.is_file():
        import subprocess
        subprocess.run([sys.executable, str(dedupe_script)], check=False)

    print(f"Clubes: {len(state.clubs)} resolvidos, {len(state.unknown)} para revisar")
    print(f"Escudos PNG: não copiados (use Gerar escudo ou upload no Lab)")
    print(f"Duplicatas ignoradas na mescla: {state.skipped_duplicate}")
    print(f"Ignorados (estrangeiros): {state.skipped_foreign}")
    print(f"JSON: {OUT_JSON}")
    print("Importe no Team Lab: http://127.0.0.1:5081/team-lab.html")
    return 0


if __name__ == "__main__":
    sys.exit(main())
