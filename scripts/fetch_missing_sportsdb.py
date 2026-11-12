import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_ASSETS = ROOT / "public" / "assets"
MANIFEST_PATH = ROOT / "src" / "data" / "assetManifest.json"

HEADERS = {
    "User-Agent": "FootballSolitaireAssociations/1.0"
}


def fetch_json(url: str) -> dict | None:
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        print(f"  [WARN] {url}: {exc}")
        return None


def download_file(url: str, dest: Path) -> bool:
    if not url:
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()
        if len(data) < 400:
            return False
        dest.write_bytes(data)
        return True
    except Exception as exc:
        print(f"  [WARN] dl {url}: {exc}")
        return False


def ext_from_url(url: str, default: str = ".png") -> str:
    path = urllib.parse.urlparse(url).path.lower()
    for ext in (".png", ".jpg", ".jpeg", ".webp", ".svg"):
        if path.endswith(ext):
            return ".jpg" if ext == ".jpeg" else ext
    return default


def main():
    manifest = json.loads(MANIFEST_PATH.read_text("utf-8"))

    # 1. Missing club_brighton
    data = fetch_json("https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=Brighton")
    if data and data.get("teams"):
        badge = data["teams"][0].get("strBadge")
        if badge:
            ext = ext_from_url(badge)
            dest = PUBLIC_ASSETS / "clubs" / f"club_brighton{ext}"
            if download_file(badge, dest):
                manifest["club_brighton"] = {"badge": f"/assets/clubs/club_brighton{ext}", "source": "thesportsdb"}
                print("OK club_brighton:", manifest["club_brighton"])
    time.sleep(2.2)

    # 2. Cups & Trophies from TheSportsDB
    cups = [
        ("cup_champions_league", "4480", "UEFA_Champions_League"),
        ("cup_europa_league", "4481", "UEFA_Europa_League"),
        ("cup_fa_cup", "4482", "FA_Cup"),
        ("cup_efl_cup", "4570", "EFL_Cup"),
        ("cup_world_cup", "4429", "FIFA_World_Cup_Trophy"),
        ("cup_euro", "4502", "UEFA_European_Championship"),
        ("cup_copa_america", "4499", "Copa_América_trophy"),
        ("cup_copa_del_rey", "4483", "Copa_del_Rey"),
        ("cup_dfb_pokal", "4484", "DFB-Pokal"),
        ("cup_coppa_italia", "4506", "Coppa_Italia"),
    ]
    for asset_id, lid, wiki_fallback in cups:
        d = fetch_json(f"https://www.thesportsdb.com/api/v1/json/123/lookupleague.php?id={lid}")
        entry = manifest.get(asset_id, {})
        if d and d.get("leagues"):
            lg = d["leagues"][0]
            if lg.get("strBadge") and not entry.get("badge"):
                ext = ext_from_url(lg["strBadge"])
                dest = PUBLIC_ASSETS / "cups" / f"{asset_id}{ext}"
                if download_file(lg["strBadge"], dest):
                    entry["badge"] = f"/assets/cups/{asset_id}{ext}"
                    entry["source"] = "thesportsdb"
            if lg.get("strTrophy"):
                ext = ext_from_url(lg["strTrophy"])
                dest = PUBLIC_ASSETS / "trophies" / f"{asset_id}_trophy{ext}"
                if download_file(lg["strTrophy"], dest):
                    entry["trophy"] = f"/assets/trophies/{asset_id}_trophy{ext}"
        if not entry.get("badge"):
            wd = fetch_json(f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(wiki_fallback)}")
            if wd and isinstance(wd.get("thumbnail"), dict):
                url = wd["thumbnail"]["source"]
                ext = ext_from_url(url, ".jpg")
                dest = PUBLIC_ASSETS / "cups" / f"{asset_id}{ext}"
                if download_file(url, dest):
                    entry["badge"] = f"/assets/cups/{asset_id}{ext}"
                    entry["source"] = "wikipedia"
        manifest[asset_id] = entry
        print("OK cup:", asset_id, entry)
        time.sleep(2.2)

    # 3. Featured Player Cutouts (transparent PNGs!)
    cutout_players = [
        ("player_cristiano_ronaldo", "Cristiano Ronaldo"),
        ("player_lionel_messi", "Lionel Messi"),
        ("player_david_beckham", "David Beckham"),
        ("player_thierry_henry", "Thierry Henry"),
        ("player_zlatan", "Zlatan Ibrahimovic"),
        ("player_gareth_bale", "Gareth Bale"),
        ("player_luka_modric", "Luka Modric"),
        ("player_eden_hazard", "Eden Hazard"),
        ("player_andrea_pirlo", "Andrea Pirlo"),
        ("player_wayne_rooney", "Wayne Rooney"),
        ("player_mohamed_salah", "Mohamed Salah"),
        ("player_erling_haaland", "Erling Haaland"),
        ("player_harry_kane", "Harry Kane"),
        ("player_kylian_mbappe", "Kylian Mbappe"),
    ]
    for pid, q in cutout_players:
        key = "player_mbappe" if pid == "player_kylian_mbappe" else pid
        d = fetch_json(f"https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p={urllib.parse.quote(q)}")
        if d and d.get("player"):
            for p in d["player"]:
                if (p.get("strSport") or "").lower() == "soccer" and p.get("strCutout"):
                    url = p["strCutout"]
                    ext = ext_from_url(url, ".png")
                    dest = PUBLIC_ASSETS / "players" / f"{key}_cutout{ext}"
                    if download_file(url, dest):
                        manifest[key] = {
                            "image": f"/assets/players/{key}_cutout{ext}",
                            "isCutout": True,
                            "source": "thesportsdb",
                        }
                        print("OK cutout:", key, manifest[key]["image"])
                        break
        time.sleep(2.2)

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("Updated manifest successfully!")


if __name__ == "__main__":
    main()
