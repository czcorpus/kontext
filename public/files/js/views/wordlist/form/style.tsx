/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

// ---------------- <WordListForm /> --------------------------------------

export const WordListForm = styled.form`

    margin: ${theme.pageFormMargin};

    .wordlist_form .current-wlattr {
        font-weight: bold;
        color: ${theme.colorLogoPink};
    }

    .wl-option-list {
        list-style-type: none;
        padding-left: 0;
        margin-left: 0;

        .hint {
            width: 60%;
        }
    }

`;

// ---------------- <ExistingFileOps /> --------------------------------------

export const ExistingFileOps = styled.div`

    .active-file {
        color: ${theme.colorLogoPink};
    }
`;

// ---------------- <IncludeNonWordsCheckboxSpan /> --------------------------------------

export const IncludeNonWordsCheckboxSpan = styled.span`
    input[type='checkbox'] {
        margin: 0;
    }
`;

// ---------------- <FieldsetFilterOptions /> ---------------------------------------------

export const FieldsetFilterOptions = styled.section`
    margin-top: 0.7em;

    .contents {
        padding: 1.1em 1.5em;
        border: 0.1em solid ${theme.colorLightFrame};
        border-radius: ${theme.borderRadiusDefault};

        display: grid;
        grid-template-columns: 10em 1fr;
        grid-gap: 0.7em;
        align-items: center;
    }
`;

// ---------------- <FieldsetOutputOptions /> --------------------------------------

export const FieldsetOutputOptions = styled.section`
    margin-top: 0.7em;

    .contents {
        padding: 1.1em 1.5em;
        border: 0.1em solid ${theme.colorLightFrame};
        border-radius: ${theme.borderRadiusDefault};

        display: grid;
        grid-template-columns: 10em 1fr;
        grid-gap: 0.7em;
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

    label {

    }

`;

// --------------- <WlpatternInput /> -------------------------------------------

export const WlpatternInput = styled.span`

    input {
        border: 1px solid ${theme.colorLightFrame};
        border-radius: ${theme.borderRadiusDefault};
        font-size: 1.4em;
        padding: 0.2em 0.3em;
        width: 8em;
    }
`;


// ---------------- <MultiLevelPosAttr /> --------------------------------------


export const MultiLevelPosAttr = styled.ul`

    list-style-type: none;
    margin: 0.7em 0 0 1.5em;
    padding: 0;

    li {
        margin: 0;
        padding: 0;
    }

    li:not(:first-child) {
        padding-top: 0.3em;
    }
`;
