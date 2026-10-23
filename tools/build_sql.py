#!/usr/bin/env python3
"""Builds sql/cric_scorer.sql (schema + IPL & international squads) from data/*.json"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GROUNDS = {'CSK':'MA Chidambaram Stadium, Chennai','MI':'Wankhede Stadium, Mumbai','RCB':'M. Chinnaswamy Stadium, Bengaluru',
  'KKR':'Eden Gardens, Kolkata','SRH':'Rajiv Gandhi Intl. Stadium, Hyderabad','DC':'Arun Jaitley Stadium, Delhi',
  'PBKS':'Maharaja Yadavindra Singh Stadium, Mullanpur','RR':'Sawai Mansingh Stadium, Jaipur','LSG':'Ekana Cricket Stadium, Lucknow',
  'GT':'Narendra Modi Stadium, Ahmedabad'}
ROLES = {'Batter','Bowler','All-rounder','Wicket-keeper'}
def s(v):
    if v is None or v == '': return 'NULL'
    return "'" + str(v).replace('\\','\\\\').replace("'","''") + "'"
out = [open(os.path.join(ROOT,'sql','schema.sql'), encoding='utf-8').read(), '\n-- ===== Seed data: teams & players =====\n']
tid = 0; total = 0
for fname, cat in (('ipl_squads.json','ipl'), ('intl_squads.json','international')):
    data = json.load(open(os.path.join(ROOT,'data',fname), encoding='utf-8'))
    for t in data['teams']:
        tid += 1
        cap = t.get('captain') if t.get('captain') not in (None,'','TBA') else None
        out.append(f"INSERT INTO teams (id, name, short_name, color, category, captain, home_ground) VALUES ({tid}, {s(t['name'])}, {s(t['short_name'])}, {s(t['color'].upper())}, '{cat}', {s(cap)}, {s(GROUNDS.get(t['short_name']))});")
        rows = []
        for p in t['players']:
            role = p.get('role') if p.get('role') in ROLES else 'Batter'
            country = p.get('country') or (t['name'] if cat == 'international' else 'India')
            overseas = 1 if (cat == 'ipl' and p.get('overseas')) else 0
            rows.append(f"({tid}, {s(p['name'])}, '{role}', {s(p.get('batting_style') or 'Right-hand bat')}, {s(p.get('bowling_style'))}, {s(country)}, {overseas})")
        total += len(rows)
        out.append("INSERT INTO players (team_id, name, role, batting_style, bowling_style, country, is_overseas) VALUES\n" + ",\n".join(rows) + ";")
out.append('')
open(os.path.join(ROOT,'sql','cric_scorer.sql'),'w', encoding='utf-8').write('\n'.join(out))
print(f'teams={tid} players={total}')
