import { describe, expect, it } from 'vitest';
import {
  getDailyPuzzleInfo,
  maskCareerToken,
  maskGoalsToken,
  parseWikipediaInfoboxHtml,
  searchPlayerOptions,
} from './careerPathApi';

describe('careerPathApi', () => {
  it('masks club, years, apps, and goals preserving exact character lengths', () => {
    expect(maskCareerToken('Manchester United')).toBe('---------- ------');
    expect(maskCareerToken('2015–2017')).toBe('---- ----');
    expect(maskCareerToken('196')).toBe('---');
    expect(maskGoalsToken('84')).toBe('(--)');
    expect(maskGoalsToken('5')).toBe('(-)');
  });

  it('parses real Wikipedia footballer infobox HTML cleanly (including loans & styles)', () => {
    const sampleHtml = `
      <table class="infobox vcard">
        <tbody>
          <tr><td colspan="4" class="infobox-image"><img src="//upload.wikimedia.org/wikipedia/commons/thumb/kdb.jpg/220px-kdb.jpg" /></td></tr>
          <tr><th colspan="4" class="infobox-header">Personal information</th></tr>
          <tr><th class="infobox-label">Full name</th><td class="infobox-data">Kevin De Bruyne<sup class="reference">[1]</sup></td></tr>
          <tr><th class="infobox-label">Date of birth</th><td class="infobox-data">(1991-06-28) 28 June 1991 (age&#160;35)</td></tr>
          <tr><th class="infobox-label">Place of birth</th><td class="infobox-data">Drongen, Belgium</td></tr>
          <tr><th class="infobox-label">Position(s)</th><td class="infobox-data"><style>.mw-parser-output .hlist{margin:0}</style>Midfielder</td></tr>
          <tr><th colspan="4" class="infobox-header">Senior career*</th></tr>
          <tr><th>Years</th><th>Team</th><th>Apps</th><th>(Gls)</th></tr>
          <tr><td>2008–2012</td><td>Genk</td><td>97</td><td>(16)</td></tr>
          <tr><td>2012–2014</td><td>Chelsea</td><td>3</td><td>(0)</td></tr>
          <tr><td>2012–2013</td><td>→ Werder Bremen (loan)</td><td>33</td><td>(10)</td></tr>
          <tr><td>2015–2025</td><td>Manchester City</td><td>285</td><td>(72)</td></tr>
          <tr><td>Total</td><td></td><td>418</td><td>(98)</td></tr>
          <tr><th colspan="4" class="infobox-header">International career</th></tr>
          <tr><td>2011</td><td>Belgium U21</td><td>2</td><td>(0)</td></tr>
          <tr><td>2010–</td><td>Belgium</td><td>128</td><td>(41)</td></tr>
        </tbody>
      </table>
    `;

    const parsed = parseWikipediaInfoboxHtml(sampleHtml);
    expect(parsed).not.toBeNull();
    expect(parsed?.fullName).toBe('Kevin De Bruyne');
    expect(parsed?.position).toBe('Midfielder');
    expect(parsed?.birthDate).toBe('28 June 1991');
    expect(parsed?.infoboxImageUrl).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/kdb.jpg/220px-kdb.jpg'
    );
    expect(parsed?.seniorCareer).toHaveLength(4);
    expect(parsed?.seniorCareer[2]).toEqual({
      years: '2012–2013',
      team: 'Werder Bremen',
      isLoan: true,
      apps: '33',
      goals: '10',
    });
    expect(parsed?.internationalCareer).toEqual([
      { years: '2010–', team: 'Belgium', isLoan: undefined, apps: '128', goals: '41' },
    ]);
  });

  it('supports diacritic-insensitive & alias autocomplete search while excluding previous misses', () => {
    const kdbMatches = searchPlayerOptions('kdb', new Set());
    expect(kdbMatches.some((p) => p.name === 'Kevin De Bruyne')).toBe(true);

    const modricMatches = searchPlayerOptions('Modric', new Set());
    expect(modricMatches[0]?.name).toBe('Luka Modrić');

    const excluded = searchPlayerOptions('Modric', new Set(['Luka Modrić']));
    expect(excluded.some((p) => p.name === 'Luka Modrić')).toBe(false);

    const initialMatches = searchPlayerOptions('E. Hazard', new Set());
    expect(initialMatches[0]?.name).toBe('Eden Hazard');

    const typoMatches = searchPlayerOptions('Hazzard', new Set());
    expect(typoMatches[0]?.name).toBe('Eden Hazard');
  });

  it('picks a deterministic daily Career Path challenge per UTC date', () => {
    const dayA = new Date('2026-11-12T10:00:00Z');
    const dayB = new Date('2026-11-12T23:45:00Z');
    const dayC = new Date('2026-11-13T08:00:00Z');

    const p1 = getDailyPuzzleInfo('normal', dayA);
    const p2 = getDailyPuzzleInfo('normal', dayB);
    const p3 = getDailyPuzzleInfo('normal', dayC);

    expect(p1.puzzleNumber).toBe(p2.puzzleNumber);
    expect(p1.player.id).toBe(p2.player.id);
    expect(p3.puzzleNumber).toBe(p1.puzzleNumber + 1);
  });
});
