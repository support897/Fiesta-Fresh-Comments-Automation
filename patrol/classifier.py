"""Lead classifier — faithful Python port of the keyword engine in bot/bot.ts.

Unsure posts are SKIPPED here (the old bot asked Gemini; this runner has no
AI key, so it stays conservative and only drafts unambiguous leads).
"""
import re

from classifier_data import (
    SERVICE_BOND, SERVICE_CARPET, SERVICE_COMMERCIAL, SERVICE_HOME,
    REQUEST_SIGNALS, STRONG_LEAD_PHRASES, HARD_DISQUALIFIERS,
    SOFT_DISQUALIFIERS, OUT_OF_SCOPE, OWN_AD_MARKERS, GEO_EXCLUDE,
)

# Builders / post-construction is its own clean type now (it used to live
# inside COMMERCIAL). Moved keywords are removed from the commercial list.
SERVICE_BUILDERS = [
    'builders clean', 'builder clean', 'builders cleaning',
    'post construction clean', 'construction clean', 'renovation clean',
    'reno clean', 'after builders clean', 'site clean',
]

_GENERIC_SERVICE_WORDS = {
    'cleaner', 'cleaners', 'cleaning', 'cleaning service',
    'cleaning services', 'cleaning company', 'cleaning lady',
}

# Small robustness additions beyond bot.ts: plural/singular forms the original
# keyword lists missed (e.g. "clean my carpets" never matched SERVICE_CARPET).
_CARPER_EXTRA = ['carpets', 'carpet cleaned']

# Most-specific first: bond/carpet/builders beat commercial/home.
_SERVICE_LINES = [
    ('bond', SERVICE_BOND),
    ('carpet', SERVICE_CARPET + _CARPER_EXTRA),
    ('builders', SERVICE_BUILDERS),
    ('commercial', [w for w in SERVICE_COMMERCIAL if w not in SERVICE_BUILDERS]),
    ('home', SERVICE_HOME),
]

SERVICE_SPECIFIC = [
    w for _key, words in _SERVICE_LINES for w in words
    if w not in _GENERIC_SERVICE_WORDS
]


def normalize(text):
    t = (text or '').lower()
    t = re.sub(r'[’‘`]', "'", t)
    t = re.sub(r"[^a-z0-9'\s]", ' ', t)
    t = re.sub(r'\s+', ' ', t)
    return t.strip()


def _norm_phrase(phrase):
    p = phrase.lower()
    p = re.sub(r"[^a-z0-9'\s]", ' ', p)
    p = re.sub(r'\s+', ' ', p)
    return p.strip()


def has_phrase(haystack, phrase):
    p = _norm_phrase(phrase)
    if not p:
        return False
    return re.search(r'(^|\s)' + re.escape(p) + r'(\s|$)', haystack) is not None


def first_match(haystack, phrases):
    for p in phrases:
        if has_phrase(haystack, p):
            return p
    return None


def detect_service_line(post_text):
    """Returns (line_key, matched_word) or None."""
    text = normalize(post_text)
    for key, words in _SERVICE_LINES:
        hit = first_match(text, words)
        if hit:
            return key, hit
    return None


def quick_keyword_filter(post_text):
    """'approve' | 'reject' | 'unsure' — mirrors bot.ts step order."""
    text = normalize(post_text)
    if not text or len(text) < 12:
        return 'reject', 'too short'

    own_ad = first_match(text, OWN_AD_MARKERS)
    if own_ad:
        return 'reject', f'own ad: {own_ad}'

    bad = first_match(text, HARD_DISQUALIFIERS)
    if bad:
        return 'reject', f'disqualifier: {bad}'

    faraway = first_match(text, GEO_EXCLUDE)
    if faraway:
        return 'reject', f'outside service area: {faraway}'

    oos = first_match(text, OUT_OF_SCOPE)
    if oos and not first_match(text, SERVICE_SPECIFIC):
        return 'reject', f'out of scope: {oos}'

    strong = first_match(text, STRONG_LEAD_PHRASES)
    if strong:
        return 'approve', f'strong phrase: {strong}'

    svc = detect_service_line(text)
    ask = first_match(text, REQUEST_SIGNALS)
    if svc and ask:
        return 'approve', f'{svc[0]}: "{svc[1]}" + "{ask}"'

    if svc:
        return 'unsure', f'mentions {svc[0]} but no request signal'

    soft = first_match(text, SOFT_DISQUALIFIERS)
    if soft:
        return 'reject', f'advertiser signal: {soft}'

    return 'reject', 'no lead signal'
