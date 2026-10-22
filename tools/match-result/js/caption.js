/* Caption & hashtags, written from the card's own data (window.__posterState), ready to copy into a Facebook / Instagram post.
   Same file in every tools/<id>/js/; js/ui.js shows the box. Which card it is comes from the folder name.
   CaptionGen.make(card, state, lang, variant) -> text. lang: 'en' | 'bn' | 'bl' (Banglish). variant picks another wording (Rewrite). */
(function () {
  const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const tag = s => { const t = clean(s).replace(/[^\p{L}\p{N}]+/gu, ''); return t ? '#' + t : ''; };
  const list = (a, lang) => {
    a = a.map(clean).filter(Boolean);
    if (a.length < 2) return a.join('');
    const and = lang === 'bn' ? ' ও ' : lang === 'bl' ? ' ar ' : ' and ';
    return a.slice(0, -1).join(', ') + and + a[a.length - 1];
  };
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${+m[3]} ${MON[+m[2] - 1]}` : clean(d); };
  const pts = t => t.pts !== '' && t.pts != null ? +t.pts : (+t.w || 0) * 3 + (+t.d || 0);
  const pick = (arr, v) => arr[((v % arr.length) + arr.length) % arr.length];

  // one entry per card: (state) -> { en: [...], bn: [...], bl: [...], tags: [...] }
  const CARDS = {
    mvp: s => {
      const p = s.player || {}, m = s.match || {}, st = (s.stats || []).filter(x => clean(x.value));
      const line = st.map(x => `${clean(x.label)}: ${clean(x.value)}`).join(' | ');
      return {
        en: [`🏆 MVP: ${p.name} (${p.team})\n${m.label ? m.label + ': ' : ''}${p.team} ${m.score} ${m.opponent}\n\n${line}`,
          `Man of the match goes to ${p.name}! 🔥 A huge night for ${p.team} against ${m.opponent} (${m.score}).\n\n${line}`],
        bn: [`🏆 ম্যাচের সেরা খেলোয়াড়: ${p.name} (${p.team})\n${p.team} ${m.score} ${m.opponent}\n\n${line}`,
          `${m.opponent}-এর বিপক্ষে দুর্দান্ত পারফরম্যান্সে ম্যাচসেরা ${p.name}! 🔥 (${m.score})\n\n${line}`],
        bl: [`🏆 Match er MVP: ${p.name} (${p.team})\n${p.team} ${m.score} ${m.opponent}\n\n${line}`,
          `${m.opponent} er against e ki ekta khela dekhalo ${p.name}! 🔥 MVP of the match (${m.score}).\n\n${line}`],
        tags: [p.name, p.team, m.opponent, s.tag],
      };
    },

    comparison: s => {
      const a = s.a || {}, b = s.b || {}, st = (s.stats || []).filter(x => clean(x.a) || clean(x.b));
      const rows = st.map(x => `${clean(x.label)}: ${clean(x.a)} vs ${clean(x.b)}`).join('\n');
      return {
        en: [`⚔️ ${s.title}: ${a.name} vs ${b.name}\n\n${rows}\n\nWho's better? Comment below 👇`,
          `${a.name} (${a.team}) or ${b.name} (${b.team})? The numbers side by side 👇\n\n${rows}`],
        bn: [`⚔️ ${s.title}: ${a.name} বনাম ${b.name}\n\n${rows}\n\nকে সেরা? কমেন্টে জানান 👇`,
          `${a.name} নাকি ${b.name}? পরিসংখ্যান পাশাপাশি 👇\n\n${rows}`],
        bl: [`⚔️ ${s.title}: ${a.name} vs ${b.name}\n\n${rows}\n\nKe better? Comment e janao 👇`,
          `${a.name} naki ${b.name}? Stats pasapasi dekho 👇\n\n${rows}`],
        tags: [a.name, b.name, a.team, b.team],
      };
    },

    'match-result': s => {
      const team = s.mode === 'team' && s.tm;
      const T = team ? s.tm.teams : s.teams || [];
      const A = T[0] || {}, B = T[1] || {};
      const nm = t => clean(t.name || t.team);
      const who = t => team ? nm(t) : `${nm(t)}${t.player ? ' (' + clean(t.player) + ')' : ''}`;
      const sa = +A.score, sb = +B.score, draw = sa === sb, W = sa >= sb ? A : B, L = sa >= sb ? B : A;
      const score = `${nm(A)} ${clean(A.score)}-${clean(B.score)} ${nm(B)}`;
      const sc = [A, B].map(t => clean(t.scorers) ? `⚽ ${nm(t)}: ${clean(t.scorers)}` : '').filter(Boolean).join('\n');
      return {
        en: [draw ? `${clean(s.label) || 'Full time'}: ${score}. All square! 🤝\n\n${sc}` : `${clean(s.label) || 'Full time'}: ${score} ✅\n${who(W)} beat ${who(L)}!\n\n${sc}`,
          draw ? `Honours even! ${score}.\n\n${sc}` : `${nm(W)} take the win! 🔥 ${score}.\n\n${sc}`],
        bn: [draw ? `খেলা শেষ: ${score}। ড্র! 🤝\n\n${sc}` : `খেলা শেষ: ${score} ✅\n${who(L)}-কে হারাল ${who(W)}!\n\n${sc}`,
          draw ? `সমতায় শেষ! ${score}।\n\n${sc}` : `জয় ${nm(W)}-এর! 🔥 ${score}।\n\n${sc}`],
        bl: [draw ? `Full time: ${score}. Draw! 🤝\n\n${sc}` : `Full time: ${score} ✅\n${who(W)} harailo ${who(L)} ke!\n\n${sc}`,
          draw ? `Shoman shoman! ${score}.\n\n${sc}` : `Jitlo ${nm(W)}! 🔥 ${score}.\n\n${sc}`],
        tags: [nm(A), nm(B), team ? '' : A.player, team ? '' : B.player, s.tag],
      };
    },

    'top-4': s => {
      const P = s.players || [], medal = ['🥇', '🥈', '🥉', '4️⃣'];
      const rows = P.map((p, i) => `${medal[i] || i + 1 + '.'} ${clean(p.player)}${p.team ? ' (' + clean(p.team) + ')' : ''}: ${clean(p.pts)} pts`).join('\n');
      return {
        en: [`🏁 ${s.event}: ${s.sub || 'Final standings'}\n\n${rows}${s.prize ? '\n\nPrize: ' + s.prize : ''}`,
          `And the top 4 of ${s.event} are... 👇\n\n${rows}\n\nCongratulations to all! 👏`],
        bn: [`🏁 ${s.event}: চূড়ান্ত অবস্থান\n\n${rows}${s.prize ? '\n\nপ্রাইজ: ' + s.prize : ''}`,
          `${s.event}-এর সেরা ৪ 👇\n\n${rows}\n\nসবাইকে অভিনন্দন! 👏`],
        bl: [`🏁 ${s.event}: Final standings\n\n${rows}${s.prize ? '\n\nPrize: ' + s.prize : ''}`,
          `${s.event} er top 4 holo 👇\n\n${rows}\n\nShobaike congratulations! 👏`],
        tags: [s.event, ...P.map(p => p.team)],
      };
    },

    'player-vs-player': s => {
      const [A = {}, B = {}] = s.teams || [];
      const when = [s.date, s.time, s.extra].map(clean).filter(Boolean).join(' · ');
      return {
        en: [`⚔️ ${s.title}: ${A.player} (${A.team}) vs ${B.player} (${B.team})\n🗓 ${when}\n\nWho wins this one? 👇`,
          `${s.event}, ${s.title}! ${A.player} takes on ${B.player}.\n🗓 ${when}\n\nDrop your prediction 👇`],
        bn: [`⚔️ ${s.title}: ${A.player} (${A.team}) বনাম ${B.player} (${B.team})\n🗓 ${when}\n\nকে জিতবে? কমেন্টে জানান 👇`,
          `${s.event}, ${s.title}! মুখোমুখি ${A.player} ও ${B.player}।\n🗓 ${when}\n\nআপনার প্রেডিকশন দিন 👇`],
        bl: [`⚔️ ${s.title}: ${A.player} (${A.team}) vs ${B.player} (${B.team})\n🗓 ${when}\n\nKe jitbe? Comment e bolo 👇`,
          `${s.event}, ${s.title}! Mukhomukhi ${A.player} ar ${B.player}.\n🗓 ${when}\n\nTomar prediction dao 👇`],
        tags: [A.player, B.player, A.team, B.team, s.event],
      };
    },

    'team-vs-team': s => {
      const [A = {}, B = {}] = s.teams || [];
      const when = [s.date, s.time, s.extra].map(clean).filter(Boolean).join(' · ');
      return {
        en: [`⚔️ ${s.title}: ${A.team} vs ${B.team}\n🗓 ${when}\n\nWho goes through? 👇`,
          `Big one coming up! ${A.team} face ${B.team} in the ${s.title} of ${s.event}.\n🗓 ${when}`],
        bn: [`⚔️ ${s.title}: ${A.team} বনাম ${B.team}\n🗓 ${when}\n\nকে এগিয়ে যাবে? 👇`,
          `বড় ম্যাচ আসছে! ${s.event}-এর ${s.title}-এ মুখোমুখি ${A.team} ও ${B.team}।\n🗓 ${when}`],
        bl: [`⚔️ ${s.title}: ${A.team} vs ${B.team}\n🗓 ${when}\n\nKe agabe? 👇`,
          `Boro match ashche! ${s.event} er ${s.title} e mukhomukhi ${A.team} ar ${B.team}.\n🗓 ${when}`],
        tags: [A.team, B.team, s.event],
      };
    },

    transfer: s => {
      const f = s.from || {}, t = s.to || {}, st = (s.stats || []).filter(x => clean(x.v)).map(x => `${clean(x.k)}: ${clean(x.v)}`).join(' | ');
      const F = clean(f.full || f.name), T = clean(t.full || t.name);
      return {
        en: [`✍️ ${s.title || 'Done deal'}! ${s.player} joins ${T} from ${F}.\n\n${st}\n\nWelcome to ${T}! 🤝`,
          `🚨 Here we go! ${s.player}: ${F} ➡️ ${T}. ${s.kicker || ''}\n\n${st}`],
        bn: [`✍️ ডান ডিল! ${F} থেকে ${T}-এ যোগ দিলেন ${s.player}।\n\n${st}\n\n${T}-এ স্বাগতম! 🤝`,
          `🚨 অফিশিয়াল! ${s.player}: ${F} ➡️ ${T}।\n\n${st}`],
        bl: [`✍️ Done deal! ${F} theke ${T} e join korlo ${s.player}.\n\n${st}\n\nWelcome to ${T}! 🤝`,
          `🚨 Official! ${s.player}: ${F} ➡️ ${T}.\n\n${st}`],
        tags: [s.player, f.name, t.name, 'Transfer'],
      };
    },

    'best-xi': s => {
      const P = (s.players || []).filter(p => clean(p.name)), star = P[s.star] || (s.players || [])[s.star];
      const names = P.map(p => clean(p.name)).join(', ');
      return {
        en: [`⭐ ${s.title}: ${s.week} (${s.formation})\n\n${names}${star ? `\n\nStar of the week: ${star.name} (${star.rating}) 🔥` : ''}`,
          `Your ${s.event} ${s.title} for ${s.week} is here! 👇\n${names}\n\nAnyone missing? 👀`],
        bn: [`⭐ সপ্তাহের সেরা একাদশ: ${s.week} (${s.formation})\n\n${names}${star ? `\n\nসপ্তাহের তারকা: ${star.name} (${star.rating}) 🔥` : ''}`,
          `${s.event}-এর ${s.week}-এর সেরা একাদশ 👇\n${names}\n\nকেউ বাদ পড়ল? 👀`],
        bl: [`⭐ Team of the week: ${s.week} (${s.formation})\n\n${names}${star ? `\n\nWeek er star: ${star.name} (${star.rating}) 🔥` : ''}`,
          `${s.event} er ${s.week} er best XI 👇\n${names}\n\nKeu baad porlo? 👀`],
        tags: [s.event, 'TeamOfTheWeek', star && star.name],
      };
    },

    'points-table': s => {
      let T = (s.teams || []).slice(0, s.count || 99).filter(t => clean(t.name));
      if (s.autoSort) T = T.slice().sort((x, y) => pts(y) - pts(x) || ((+y.gf || 0) - (+y.ga || 0)) - ((+x.gf || 0) - (+x.ga || 0)));
      const rows = T.map((t, i) => `${i + 1}. ${clean(t.name)}${t.player ? ' (' + clean(t.player) + ')' : ''}: ${pts(t)} pts`).join('\n');
      const top = T[0] || {};
      return {
        en: [`📊 ${s.event}: ${s.title} (${s.stage})\n\n${rows}`, `${clean(top.name)} stay on top of ${s.event}! 🔝 Full table after ${s.stage} 👇\n\n${rows}`],
        bn: [`📊 ${s.event}: পয়েন্ট টেবিল (${s.stage})\n\n${rows}`, `${s.event}-এর শীর্ষে ${clean(top.name)}! 🔝 পুরো টেবিল 👇\n\n${rows}`],
        bl: [`📊 ${s.event}: Points table (${s.stage})\n\n${rows}`, `${s.event} e top e ${clean(top.name)}! 🔝 Full table 👇\n\n${rows}`],
        tags: [s.event, 'PointsTable', top.name],
      };
    },

    fixtures: s => {
      const M = (s.matches || []).slice(0, s.count || 99);
      const rows = M.map(m => `${clean(m.label)}: ${clean(m.a && m.a.name)} vs ${clean(m.b && m.b.name)}${m.time ? ' · ' + clean(m.time) : ''}${m.date ? ' (' + day(m.date) + ')' : ''}`).join('\n');
      return {
        en: [`🗓 ${s.event}: ${s.title} (${s.stage})\n\n${rows}\n\n${clean(s.start)}${s.live ? '\n📺 Live: ' + s.live : ''}`,
          `Matchday is here! ${s.stage} of ${s.event} 👇\n\n${rows}${s.live ? '\n\nWatch live: ' + s.live : ''}`],
        bn: [`🗓 ${s.event}: খেলার সূচি (${s.stage})\n\n${rows}${s.live ? '\n\n📺 লাইভ: ' + s.live : ''}`,
          `ম্যাচ ডে চলে এলো! ${s.event}, ${s.stage} 👇\n\n${rows}${s.live ? '\n\nলাইভ দেখুন: ' + s.live : ''}`],
        bl: [`🗓 ${s.event}: Match schedule (${s.stage})\n\n${rows}${s.live ? '\n\n📺 Live: ' + s.live : ''}`,
          `Match day chole ashlo! ${s.event}, ${s.stage} 👇\n\n${rows}${s.live ? '\n\nLive dekho: ' + s.live : ''}`],
        tags: [s.event, ...M.flatMap(m => [m.a && m.a.name, m.b && m.b.name])],
      };
    },

    lineup: s => {
      const [A = {}, B = {}] = s.teams || [];
      const xi = t => String(t.xi || '').split('\n').map(l => clean(l).replace(/^\d+\s+/, '').replace(/\s+[A-Z]{2,3}(\s*\(C\))?$/, '$1')).filter(Boolean).join(', ');
      return {
        en: [`📋 ${s.title}: ${A.name} vs ${B.name} (${s.stage})\n\n${A.name} (${A.formation}): ${xi(A)}\n\n${B.name} (${B.formation}): ${xi(B)}${s.live ? '\n\n📺 ' + s.live : ''}`,
          `Team news! Here's how ${A.name} and ${B.name} line up 👇\n\n${A.name}: ${xi(A)}\n\n${B.name}: ${xi(B)}`],
        bn: [`📋 শুরুর একাদশ: ${A.name} বনাম ${B.name} (${s.stage})\n\n${A.name} (${A.formation}): ${xi(A)}\n\n${B.name} (${B.formation}): ${xi(B)}`,
          `টিম নিউজ! দেখুন কারা মাঠে নামছে 👇\n\n${A.name}: ${xi(A)}\n\n${B.name}: ${xi(B)}`],
        bl: [`📋 Starting XI: ${A.name} vs ${B.name} (${s.stage})\n\n${A.name} (${A.formation}): ${xi(A)}\n\n${B.name} (${B.formation}): ${xi(B)}`,
          `Team news! Dekho ke ke namche 👇\n\n${A.name}: ${xi(A)}\n\n${B.name}: ${xi(B)}`],
        tags: [A.name, B.name, s.event, 'StartingXI'],
      };
    },

    'team-performance': s => {
      const t = s.team || {}, st = (s.stats || []).filter(x => clean(x.value)).map(x => `${clean(x.label)}: ${clean(x.value)}`).join(' | ');
      const names = l => list((s.players || []).map(p => p.name), l);
      return {
        en: [`📈 ${t.name}: ${s.title}\n${s.event}\n\n${st}${names('en') ? '\n\nSquad: ' + names('en') : ''}`, `How did ${t.name} do? 👇 ${s.title}, ${s.event}\n\n${st}`],
        bn: [`📈 ${t.name}: ${s.title}\n${s.event}\n\n${st}${names('bn') ? '\n\nস্কোয়াড: ' + names('bn') : ''}`, `${t.name} কেমন করল? 👇 ${s.title}, ${s.event}\n\n${st}`],
        bl: [`📈 ${t.name}: ${s.title}\n${s.event}\n\n${st}${names('bl') ? '\n\nSquad: ' + names('bl') : ''}`, `${t.name} kemon korlo? 👇 ${s.title}, ${s.event}\n\n${st}`],
        tags: [t.name, s.event],
      };
    },

    achievement: s => {
      const t = s.team || {}, st = (s.stats || []).filter(x => clean(x.value)).map(x => `${clean(x.label)}: ${clean(x.value)}`).join(' | ');
      const AW = { champ: ['Champions', 'চ্যাম্পিয়ন', 'Champion'], runner: ['Runners up', 'রানার্স আপ', 'Runners up'], third: ['3rd place', 'তৃতীয় স্থান', '3rd place'] };
      const aw = AW[s.award] || [s.customTitle, s.customTitle, s.customTitle];
      const names = (s.players || []).map(p => p.name);
      const mvp = (s.players || [])[s.mvp];
      return {
        en: [`🏆 ${t.name}: ${aw[0]} of ${s.event}!\n\n${st}${names.filter(Boolean).length ? '\n\nSquad: ' + list(names, 'en') : ''}${mvp && mvp.name ? '\nMVP: ' + mvp.name + ' ⭐' : ''}\n\nCongratulations! 👏`,
          `${aw[0].toUpperCase()}! 🏆 ${t.name} finish ${s.event} in style. ${s.season || ''}\n\n${st}`],
        bn: [`🏆 ${s.event}-এর ${aw[1]} ${t.name}!\n\n${st}${names.filter(Boolean).length ? '\n\nস্কোয়াড: ' + list(names, 'bn') : ''}${mvp && mvp.name ? '\nএমভিপি: ' + mvp.name + ' ⭐' : ''}\n\nঅভিনন্দন! 👏`,
          `${aw[1]}! 🏆 দুর্দান্তভাবে ${s.event} শেষ করল ${t.name}।\n\n${st}`],
        bl: [`🏆 ${s.event} er ${aw[2]} ${t.name}!\n\n${st}${names.filter(Boolean).length ? '\n\nSquad: ' + list(names, 'bl') : ''}${mvp && mvp.name ? '\nMVP: ' + mvp.name + ' ⭐' : ''}\n\nCongratulations! 👏`,
          `${aw[2]}! 🏆 Darun vabe ${s.event} shesh korlo ${t.name}.\n\n${st}`],
        tags: [t.name, s.event, aw[0]],
      };
    },
  };

  const BASE = ['#eFCB', '#eFootball', '#eFootballBangladesh'];
  function make(card, s, lang, variant) {
    const f = CARDS[card]; if (!f || !s) return '';
    const c = f(s);
    const body = pick(c[lang] || c.en, variant || 0).replace(/\n{3,}/g, '\n\n').replace(/\(\s*\)/g, '').replace(/ +/g, ' ').trim();
    const tags = [...new Set([...BASE, ...(c.tags || []).map(tag)].filter(Boolean))].slice(0, 9).join(' ');
    return body + '\n\n' + tags;
  }
  window.CaptionGen = { make, cards: Object.keys(CARDS) };
})();
