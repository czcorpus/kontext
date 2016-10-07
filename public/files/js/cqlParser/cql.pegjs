/*
 * Copyright (c) 1999-2015  Pavel Rychly, Milos Jakubicek
 * Copyright (c) 2016 Tomas Machalek
 *
 * This is a PEG version of an original CQL grammar (except for the
 * regular expression grammar) distributed with manatee-open
 * corpus search engine.
 */

Query =
    Sequence _ (BINAND GlobPart)? (NOT? (KW_WITHIN / KW_CONTAINING) _ WithinContainingPart)* SEMI


GlobPart =
    GlobCond (_ BINAND GlobCond)*

GlobCond =
    NUMBER DOT ATTR NOT? EQ NUMBER DOT ATTR
    / KW_FREQ LPAREN NUMBER DOT ATTR RPAREN NOT? ( EQ / LEQ / GEQ / LSTRUCT / RSTRUCT ) NUMBER

Position =
    OnePosition
    / NUMBER COLON OnePosition
    // TODO

OnePosition =
    LBRACKET _ AttValList? _ RBRACKET
    / RegExp
    / TEQ NUMBER? RegExp
    / KW_MU
    / MuPart

WithinContainingPart =
    LSTRUCT Structure RSTRUCT
    / Sequence
    / WithinNumber
    / NOT? AlignedPart

Structure =
    ATTR _ AttValList?

// -------------------- meet/union query --------------------

MuPart =
    LPAREN _ (UnionOp / MeetOp) _ RPAREN

Integer =
    NUMBER / NNUMBER

MeetOp =
    KW_MEET _ Position _ Position _ (Integer _ Integer)?

UnionOp =
    KW_UNION _ Position _ Position

// -------------------- regular expression query --------------------
Sequence =
    Seq (_ BINOR _ Seq)*

Seq =
    NOT? (Repetition _)+

Repetition =
    AtomQuery RepOpt?
    / LSTRUCT (Structure _ SLASH? / SLASH _ Structure) RSTRUCT

AtomQuery =
    Position
    / LPAREN Sequence (_ NOT? _ KW_WITHIN _ WithinContainingPart)* RPAREN

AlignedPart =
    ATTR COLON _ Sequence  // parallel alignment

AttValList =
    AttValAnd (_ BINOR _ AttValAnd)*

AttValAnd =
    AttVal (_ BINAND _ AttVal)*

AttVal =
    ATTR _ NOT? (EQ / LEQ / GEQ / TEQ NUMBER?) _ RegExp
    / POSNUM NUMBER DASH NUMBER
    / POSNUM NUMBER
    / NOT AttVal
    / LPAREN AttValList RPAREN
    / (KW_WS / KW_TERM) LPAREN (NUMBER COMMA NUMBER / RegExp COMMA RegExp COMMA RegExp) RPAREN
    / KW_SWAP LPAREN NUMBER COMMA AttValList RPAREN
    / KW_CCOLL LPAREN NUMBER COMMA NUMBER COMMA AttValList RPAREN

WithinNumber =
    NUMBER

RepOpt =
    STAR / PLUS / QUEST / LBRACE NUMBER (COMMA NUMBER?)? RBRACE

// ---------------- Regular expression with balanced parentheses --------

RegExp =
    QUOT RegExpRaw QUOT

RegExpRaw =
    (RgGrouped / RgSimple)+

RgGrouped =
    LPAREN RegExpRaw RPAREN

RgSimple =
    (RgRange / RgChar / RgAlt)+

RgAlt =
    LBRACKET (RgChar / DASH)+ RBRACKET

RgChar =
    RgEscaped / [a-zA-ZáčďéěíňóřšťúůýÁČĎÉĚÍŇÓŘŠŤÚŮÝÄäÖöÜüß0-9\?\*\+\.\|]
    // TODO - there are missing chars here

RgEscaped =
    '\\{' / '\\}' / '\\(' / '\\)' / '\\[' / '\\]'

// {n}, {n,}, {n,m}
RgRange =
    LBRACE RgRangeSpec RBRACE

RgRangeSpec =
    NUMBER COMMA NUMBER? / NUMBER

// ------------------------------- tokens -------------------------------

NUMBER = [0-9]+
NNUMBER = '-'[0-9]+

ATTR = [a-zA-Z][a-zA-Z0-9@_]*

QUOT = '"';
DASH = '-';
LPAREN = '(';
RPAREN = ')';
LBRACKET = '[';
RBRACKET = ']';
LBRACE = '{';
RBRACE = '}';

STAR = '*'
PLUS = '+'
QUEST = '?'

BINOR = '|'
BINAND = '&'
DOT = '.'
COMMA = ','
SEMI = ';'
COLON =  ':'
EQ = '='
EEQ = '=='
TEQ = '~'
NOT = '!'
LEQ = '<='
GEQ = '>='
LSTRUCT = '<'
RSTRUCT = '>'
SLASH = '/'
POSNUM = '#'

KW_MEET = 'meet'
KW_UNION = 'union'
KW_WITHIN = 'within'
KW_CONTAINING = 'containing'
KW_MU = 'MU'
KW_FREQ = 'f'
KW_WS = 'ws'
KW_TERM = 'term'
KW_SWAP = 'swap'
KW_CCOLL = 'ccoll'

_ "whitespace"
  = [ \t\n\r]*