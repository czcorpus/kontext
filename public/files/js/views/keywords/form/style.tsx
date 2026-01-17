/*
 * Copyright (c) 2023 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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


import { styled } from 'styled-components';
import * as theme from '../../theme/default/index.js';

// ---------------- <KeywordsForm /> --------------------------------------

export const KeywordsForm = styled.form`

    margin: 1.5em;

    .corp-sel {
        display: grid;
        grid-template-columns: 10em 100%;
        grid-row-gap: 0.7em;
        align-items: center;
    }

    #kw-filters {
        margin: 0 0 2em 0;
    }
`;

// ---------------- <MainFieldset /> --------------------------------------------

export const MainFieldset = styled.div`

    display: grid;
    grid-template-columns: 10em auto;
    grid-gap: 0.7em;
    align-items: center;
    margin-top: 3.4em;
    margin-bottom: 1.6em;

    fieldset {
        border-spacing: 0;
        border: 1px solid ${theme.colorLightFrame};
        border-radius: ${theme.borderRadiusDefault};
    }

`;


// ---------------- <IncludeNonWordsCheckboxSpan /> --------------------------------------

export const IncludeNonWordsCheckboxSpan = styled.span`
    input[type='checkbox'] {
        margin: 0;
    }
`;

// ---------------- <KeywordsFilterFieldset /> -----------------------------------


export const KeywordsFilterFieldset = styled.fieldset`
    width: 100%;
    display: grid;
    grid-template-columns: 19em auto;
    grid-gap: 0.7em;
    margin-top: 0.5em;
    margin-bottom: 1.6em;
    padding: 1.5em 2em;

    .freq input[type=text] {
        width: 4em;
    }

    .pattern {
        font-size: 1.4em;
        font-family: ${theme.monospaceFontFamily};
    }

    span.min-score {
        color: ${theme.colorDefaultText};
    }
`;

// ----------------- <IncludeNonWordsCheckbox /> ---------------------------------

export const IncludeNonWordsCheckbox = styled.div`

    .toggle {
        width: 2em;
        height: 2em;
    }
`;