import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_ASSETS = ROOT / "public" / "assets"
MANIFEST_PATH = ROOT / "src" / "data" / "assetManifest.json"

HEADERS = {
    "User-Agent": "FootballSolitaireAssociations/1.0 (https://github.com/local/football-solitaire)"
}


def fetch_json(url: str) -> dict | None:
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        print(f"  [WARN] JSON fetch failed {url}: {exc}")
        return None


def download_file(url: str, dest: Path) -> bool:
    if dest.exists() and dest.stat().st_size > 500:
        return True
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
        print(f"  [WARN] Download failed {url}: {exc}")
        return False


def wiki_thumb(page_title: str) -> str | None:
    encoded = urllib.parse.quote(page_title.replace(" ", "_"))
    data = fetch_json(f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}")
    if data and isinstance(data.get("thumbnail"), dict):
        return data["thumbnail"].get("source")
    return None


def ext_from_url(url: str, default: str = ".png") -> str:
    path = urllib.parse.urlparse(url).path.lower()
    for ext in (".png", ".jpg", ".jpeg", ".webp", ".svg"):
        if path.endswith(ext):
            return ".jpg" if ext == ".jpeg" else ext
    return default


# Leagues & Cups from TheSportsDB lookupleague + Wikipedia fallback
LEAGUES_AND_CUPS = [
    ("league_premier_league", "leagues", "4328", "Premier_League"),
    ("league_championship", "leagues", "4329", "EFL_Championship"),
    ("league_league_one", "leagues", "4396", "EFL_League_One"),
    ("league_league_two", "leagues", "4397", "EFL_League_Two"),
    ("league_la_liga", "leagues", "4335", "La_Liga"),
    ("league_bundesliga", "leagues", "4331", "Bundesliga"),
    ("league_serie_a", "leagues", "4332", "Serie_A"),
    ("league_ligue_1", "leagues", "4334", "Ligue_1"),
    ("league_eredivisie", "leagues", "4337", "Eredivisie"),
    ("league_scottish_prem", "leagues", "4330", "Scottish_Premiership"),
    ("league_liga_portugal", "leagues", "4344", "Primeira_Liga"),
    ("league_mls", "leagues", "4346", "Major_League_Soccer"),
    ("cup_champions_league", "cups", "4480", "UEFA_Champions_League"),
    ("cup_europa_league", "cups", "4481", "UEFA_Europa_League"),
    ("cup_fa_cup", "cups", "4482", "FA_Cup"),
    ("cup_efl_cup", "cups", "4570", "EFL_Cup"),
    ("cup_world_cup", "cups", "4429", "FIFA_World_Cup"),
    ("cup_euro", "cups", "4502", "UEFA_European_Championship"),
    ("cup_copa_america", "cups", "4499", "Copa_América"),
    ("cup_copa_del_rey", "cups", "4483", "Copa_del_Rey"),
    ("cup_dfb_pokal", "cups", "4484", "DFB-Pokal"),
    ("cup_coppa_italia", "cups", "4506", "Coppa_Italia"),
]

# Clubs: (asset_id, TheSportsDB search query, Wikipedia title fallback)
CLUBS = [
    ("club_arsenal", "Arsenal", "Arsenal_F.C."),
    ("club_chelsea", "Chelsea", "Chelsea_F.C."),
    ("club_liverpool", "Liverpool", "Liverpool_F.C."),
    ("club_man_utd", "Manchester United", "Manchester_United_F.C."),
    ("club_man_city", "Manchester City", "Manchester_City_F.C."),
    ("club_tottenham", "Tottenham Hotspur", "Tottenham_Hotspur_F.C."),
    ("club_newcastle", "Newcastle United", "Newcastle_United_F.C."),
    ("club_aston_villa", "Aston Villa", "Aston_Villa_F.C."),
    ("club_everton", "Everton", "Everton_F.C."),
    ("club_brighton", "Brighton", "Brighton_%26_Hove_Albion_F.C."),
    ("club_fulham", "Fulham", "Fulham_F.C."),
    ("club_west_ham", "West Ham United", "West_Ham_United_F.C."),
    ("club_leicester", "Leicester City", "Leicester_City_F.C."),
    ("club_blackburn", "Blackburn Rovers", "Blackburn_Rovers_F.C."),
    ("club_nottingham_forest", "Nottingham Forest", "Nottingham_Forest_F.C."),
    ("club_ipswich", "Ipswich Town", "Ipswich_Town_F.C."),
    ("club_leeds", "Leeds United", "Leeds_United_F.C."),
    ("club_sunderland", "Sunderland", "Sunderland_A.F.C."),
    ("club_burnley", "Burnley", "Burnley_F.C."),
    ("club_sheff_utd", "Sheffield United", "Sheffield_United_F.C."),
    ("club_wolves", "Wolverhampton Wanderers", "Wolverhampton_Wanderers_F.C."),
    ("club_bolton", "Bolton Wanderers", "Bolton_Wanderers_F.C."),
    ("club_west_brom", "West Bromwich Albion", "West_Bromwich_Albion_F.C."),
    ("club_preston", "Preston North End", "Preston_North_End_F.C."),
    ("club_huddersfield", "Huddersfield Town", "Huddersfield_Town_A.F.C."),
    ("club_derby", "Derby County", "Derby_County_F.C."),
    ("club_coventry", "Coventry City", "Coventry_City_F.C."),
    ("club_norwich", "Norwich City", "Norwich_City_F.C."),
    ("club_middlesbrough", "Middlesbrough", "Middlesbrough_F.C."),
    ("club_southampton", "Southampton", "Southampton_F.C."),
    ("club_crystal_palace", "Crystal Palace", "Crystal_Palace_F.C."),
    ("club_crewe", "Crewe Alexandra", "Crewe_Alexandra_F.C."),
    ("club_wycombe", "Wycombe Wanderers", "Wycombe_Wanderers_F.C."),
    ("club_charlton", "Charlton Athletic", "Charlton_Athletic_F.C."),
    ("club_wigan", "Wigan Athletic", "Wigan_Athletic_F.C."),
    ("club_real_madrid", "Real Madrid", "Real_Madrid_CF"),
    ("club_barcelona", "Barcelona", "FC_Barcelona"),
    ("club_atletico", "Atletico Madrid", "Atlético_Madrid"),
    ("club_bilbao", "Athletic Bilbao", "Athletic_Bilbao"),
    ("club_valencia", "Valencia", "Valencia_CF"),
    ("club_real_sociedad", "Real Sociedad", "Real_Sociedad"),
    ("club_bayern", "Bayern Munich", "FC_Bayern_Munich"),
    ("club_dortmund", "Borussia Dortmund", "Borussia_Dortmund"),
    ("club_leverkusen", "Bayer Leverkusen", "Bayer_04_Leverkusen"),
    ("club_rb_leipzig", "RB Leipzig", "RB_Leipzig"),
    ("club_stuttgart", "VfB Stuttgart", "VfB_Stuttgart"),
    ("club_werder", "Werder Bremen", "SV_Werder_Bremen"),
    ("club_ac_milan", "AC Milan", "AC_Milan"),
    ("club_inter", "Inter Milan", "Inter_Milan"),
    ("club_juventus", "Juventus", "Juventus_FC"),
    ("club_napoli", "Napoli", "SSC_Napoli"),
    ("club_roma", "AS Roma", "AS_Roma"),
    ("club_lazio", "Lazio", "SS_Lazio"),
    ("club_atalanta", "Atalanta", "Atalanta_BC"),
    ("club_psg", "Paris SG", "Paris_Saint-Germain_F.C."),
    ("club_marseille", "Marseille", "Olympique_de_Marseille"),
    ("club_lyon", "Lyon", "Olympique_Lyonnais"),
    ("club_monaco", "Monaco", "AS_Monaco_FC"),
    ("club_lille", "Lille", "Lille_OSC"),
    ("club_ajax", "Ajax", "AFC_Ajax"),
    ("club_psv", "PSV Eindhoven", "PSV_Eindhoven"),
    ("club_sporting", "Sporting CP", "Sporting_CP"),
    ("club_benfica", "Benfica", "S.L._Benfica"),
    ("club_porto", "FC Porto", "FC_Porto"),
    ("club_dinamo_zagreb", "Dinamo Zagreb", "GNK_Dinamo_Zagreb"),
    ("club_la_galaxy", "LA Galaxy", "LA_Galaxy"),
    ("club_inter_miami", "Inter Miami", "Inter_Miami_CF"),
    ("club_ny_red_bulls", "New York Red Bulls", "New_York_Red_Bulls"),
    ("club_nycfc", "New York City", "New_York_City_FC"),
    ("club_lafc", "Los Angeles FC", "Los_Angeles_FC"),
    ("club_al_nassr", "Al-Nassr", "Al-Nassr_FC"),
    ("club_cruzeiro", "Cruzeiro", "Cruzeiro_Esporte_Clube"),
]

# Stadiums: (asset_id, Wikipedia page title)
STADIUMS = [
    ("stadium_old_trafford", "Old_Trafford"),
    ("stadium_anfield", "Anfield"),
    ("stadium_emirates", "Emirates_Stadium"),
    ("stadium_stamford_bridge", "Stamford_Bridge_(stadium)"),
    ("stadium_st_james_park", "St_James'_Park"),
    ("stadium_villa_park", "Villa_Park"),
    ("stadium_craven_cottage", "Craven_Cottage"),
    ("stadium_etihad", "City_of_Manchester_Stadium"),
    ("stadium_tottenham", "Tottenham_Hotspur_Stadium"),
    ("stadium_goodison_park", "Goodison_Park"),
    ("stadium_molineux", "Molineux_Stadium"),
    ("stadium_wembley", "Wembley_Stadium"),
    ("stadium_camp_nou", "Camp_Nou"),
    ("stadium_bernabeu", "Santiago_Bernabéu_Stadium"),
    ("stadium_san_siro", "San_Siro"),
    ("stadium_allianz_arena", "Allianz_Arena"),
    ("stadium_signal_iduna", "Westfalenstadion"),
    ("stadium_parc_des_princes", "Parc_des_Princes"),
    ("stadium_da_luz", "Estádio_da_Luz"),
    ("stadium_cruyff_arena", "Johan_Cruyff_Arena"),
    ("stadium_maracana", "Maracanã_Stadium"),
    ("stadium_azteca", "Estadio_Azteca"),
    ("stadium_hampden", "Hampden_Park"),
    ("stadium_olympiastadion", "Olympiastadion_(Berlin)"),
]

# Players & Managers: (asset_id, TheSportsDB query, Wikipedia title)
PLAYERS = [
    ("player_cristiano_ronaldo", "Cristiano Ronaldo", "Cristiano_Ronaldo"),
    ("player_lionel_messi", "Lionel Messi", "Lionel_Messi"),
    ("player_david_beckham", "David Beckham", "David_Beckham"),
    ("player_thierry_henry", "Thierry Henry", "Thierry_Henry"),
    ("player_zlatan", "Zlatan Ibrahimovic", "Zlatan_Ibrahimović"),
    ("player_wayne_rooney", "Wayne Rooney", "Wayne_Rooney"),
    ("player_alan_shearer", "Alan Shearer", "Alan_Shearer"),
    ("player_mohamed_salah", "Mohamed Salah", "Mohamed_Salah"),
    ("player_harry_kane", "Harry Kane", "Harry_Kane"),
    ("player_sergio_aguero", "Sergio Aguero", "Sergio_Agüero"),
    ("player_didier_drogba", "Didier Drogba", "Didier_Drogba"),
    ("player_erling_haaland", "Erling Haaland", "Erling_Haaland"),
    ("player_gareth_bale", "Gareth Bale", "Gareth_Bale"),
    ("player_luka_modric", "Luka Modric", "Luka_Modrić"),
    ("player_eden_hazard", "Eden Hazard", "Eden_Hazard"),
    ("player_andrea_pirlo", "Andrea Pirlo", "Andrea_Pirlo"),
    ("player_ronaldo_nazario", "Ronaldo", "Ronaldo_(Brazilian_footballer)"),
    ("player_ronaldinho", "Ronaldinho", "Ronaldinho"),
    ("player_zidane", "Zinedine Zidane", "Zinedine_Zidane"),
    ("player_pele", "Pele", "Pelé"),
    ("player_maradona", "Diego Maradona", "Diego_Maradona"),
    ("player_cruyff", "Johan Cruyff", "Johan_Cruyff"),
    ("player_george_best", "George Best", "George_Best"),
    ("player_beckenbauer", "Franz Beckenbauer", "Franz_Beckenbauer"),
    ("player_baggio", "Roberto Baggio", "Roberto_Baggio"),
    ("player_totti", "Francesco Totti", "Francesco_Totti"),
    ("player_del_piero", "Alessandro Del Piero", "Alessandro_Del_Piero"),
    ("player_maldini", "Paolo Maldini", "Paolo_Maldini"),
    ("player_gerrard", "Steven Gerrard", "Steven_Gerrard"),
    ("player_mbappe", "Kylian Mbappe", "Kylian_Mbappé"),
    ("player_kaka", "Kaka", "Kaká"),
    ("player_rodri", "Rodri", "Rodri_(footballer,_born_1996)"),
]


def main():
    manifest: dict[str, dict] = {}
    if MANIFEST_PATH.exists():
        try:
            manifest = json.loads(MANIFEST_PATH.read_text("utf-8"))
        except Exception:
            manifest = {}

    # 1. Leagues and Cups
    print("=== Fetching Leagues & Cups ===")
    for asset_id, folder, league_id, wiki_title in LEAGUES_AND_CUPS:
        data = fetch_json(f"https://www.thesportsdb.com/api/v1/json/123/lookupleague.php?id={league_id}")
        badge_url = None
        trophy_url = None
        if data and data.get("leagues"):
            lg = data["leagues"][0]
            badge_url = lg.get("strBadge")
            trophy_url = lg.get("strTrophy")

        if not badge_url:
            badge_url = wiki_thumb(wiki_title)

        entry = manifest.get(asset_id, {})
        if badge_url:
            ext = ext_from_url(badge_url, ".png")
            dest = PUBLIC_ASSETS / folder / f"{asset_id}{ext}"
            if download_file(badge_url, dest):
                entry["badge"] = f"/assets/{folder}/{asset_id}{ext}"
                entry["source"] = "thesportsdb" if "thesportsdb" in badge_url else "wikipedia"

        if trophy_url:
            ext = ext_from_url(trophy_url, ".png")
            dest = PUBLIC_ASSETS / "trophies" / f"{asset_id}_trophy{ext}"
            if download_file(trophy_url, dest):
                entry["trophy"] = f"/assets/trophies/{asset_id}_trophy{ext}"

        manifest[asset_id] = entry
        print(f"  {asset_id}: {entry}")
        time.sleep(0.18)

    # 2. Clubs
    print("\n=== Fetching Club Badges ===")
    for asset_id, query, wiki_title in CLUBS:
        entry = manifest.get(asset_id, {})
        if entry.get("badge") and (ROOT / "public" / entry["badge"].lstrip("/")).exists():
            continue
        q = urllib.parse.quote(query)
        data = fetch_json(f"https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t={q}")
        badge_url = None
        if data and data.get("teams"):
            for t in data["teams"]:
                if (t.get("strSport") or "").lower() == "soccer":
                    badge_url = t.get("strBadge")
                    break
            if not badge_url:
                badge_url = data["teams"][0].get("strBadge")
        if not badge_url:
            badge_url = wiki_thumb(wiki_title)

        if badge_url:
            ext = ext_from_url(badge_url, ".png")
            dest = PUBLIC_ASSETS / "clubs" / f"{asset_id}{ext}"
            if download_file(badge_url, dest):
                entry["badge"] = f"/assets/clubs/{asset_id}{ext}"
                entry["source"] = "thesportsdb" if "thesportsdb" in badge_url else "wikipedia"

        manifest[asset_id] = entry
        print(f"  {asset_id}: {entry.get('badge')}")
        time.sleep(0.18)

    # 3. Stadiums
    print("\n=== Fetching Stadium Images ===")
    for asset_id, wiki_title in STADIUMS:
        entry = manifest.get(asset_id, {})
        if entry.get("image") and (ROOT / "public" / entry["image"].lstrip("/")).exists():
            continue
        url = wiki_thumb(wiki_title)
        if url:
            ext = ext_from_url(url, ".jpg")
            dest = PUBLIC_ASSETS / "stadiums" / f"{asset_id}{ext}"
            if download_file(url, dest):
                entry["image"] = f"/assets/stadiums/{asset_id}{ext}"
                entry["source"] = "wikipedia"
        manifest[asset_id] = entry
        print(f"  {asset_id}: {entry.get('image')}")
        time.sleep(0.15)

    # 4. Players
    print("\n=== Fetching Player Cutouts & Portraits ===")
    for asset_id, query, wiki_title in PLAYERS:
        entry = manifest.get(asset_id, {})
        if entry.get("image") and (ROOT / "public" / entry["image"].lstrip("/")).exists():
            continue
        q = urllib.parse.quote(query)
        data = fetch_json(f"https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p={q}")
        img_url = None
        is_cutout = False
        if data and data.get("player"):
            for p in data["player"]:
                if (p.get("strSport") or "").lower() == "soccer":
                    if p.get("strCutout"):
                        img_url = p["strCutout"]
                        is_cutout = True
                        break
                    elif p.get("strThumb"):
                        img_url = p["strThumb"]
                        break
        if not img_url:
            img_url = wiki_thumb(wiki_title)

        if img_url:
            ext = ext_from_url(img_url, ".png" if is_cutout else ".jpg")
            dest = PUBLIC_ASSETS / "players" / f"{asset_id}{ext}"
            if download_file(img_url, dest):
                entry["image"] = f"/assets/players/{asset_id}{ext}"
                entry["isCutout"] = is_cutout
                entry["source"] = "thesportsdb" if "thesportsdb" in img_url else "wikipedia"
        manifest[asset_id] = entry
        print(f"  {asset_id}: cutout={is_cutout} img={entry.get('image')}")
        time.sleep(0.18)

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nDone! Wrote {len(manifest)} entries to {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
