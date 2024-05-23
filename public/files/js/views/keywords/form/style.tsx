/*
 * Copyright (c) 2023 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
 * Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; version 2
 * dated June, 1991.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */


import styled from 'styled-components';
import * as theme from '../../theme/default';

// ---------------- <KeywordsForm /> --------------------------------------

export const KeywordsForm = styled.form`

    .corp-sel {
        display: grid;
        grid-template-columns: 10em 100%;
        grid-row-gap: 0.7em;
        align-items: center;
    }

`;

// ---------------- <MainFieldset /> --------------------------------------------

export const MainFieldset = styled.div`

    display: grid;
    grid-template-columns: 10em 1fr;
    grid-gap: 0.7em;
    align-items: center;
    margin-top: 3.4em;
    margin-bottom: 1.6em;
    max-width: 20em;

    .freq input[type=text] {
        width: 4em;
    }

    .pattern {
        font-size: 1.4em;
        font-family: ${theme.monospaceFontFamily};
    }

`;


// ---------------- <IncludeNonWordsCheckboxSpan /> --------------------------------------

export const IncludeNonWordsCheckboxSpan = styled.span`
    input[type='checkbox'] {
        margin: 0;
    }
`;