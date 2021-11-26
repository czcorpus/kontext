/*
 * Copyright (c) 2017 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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
import * as theme from '../../../views/theme/default';

// ------------------ <CorplistTable /> --------------------------------

export const CorplistTable = styled.div`



    .lock-status {
        display: inline-block;
        cursor: pointer;

        img {
            width: 1.25em;
        }
    }

    table.corplist {

        td.corpname {
            font-size: 120%;
        }

        td.corpname a {
            text-decoration: none;
        }

        td.corpname a:hover {
            text-decoration: underline;
        }

        a.keyword .overlay {
            padding: 0.2em 0.4em;
        }

        .corpname .inaccessible {
            color: ${theme.colorDefaultText};
        }
    }

    tr.load-more td {
        text-align: center;
        padding-top: 1em;
        padding-bottom: 0.7em;
    }

    td img.starred {
        cursor: pointer;
        display: inline-block;
        vertical-align: middle;
        width: 1.4em;
    }
`;

// ----------------- <FilterForm /> ----------------------------

export const FilterForm = styled.section`

    input.min-max {
        width: 70pt;
    }

    input.min-max.invalid {
        background-color: ${theme.colorErrorInputBg};
    }

    fieldset {
        margin: 0.7em 0 1.4em 0;
    }

    h3 {
        display: inline-block;
    }

    .ajax-loader {
        display: inline-block;
        margin-left: 1em;
    }

    .hint {
        font-size: 80%;
    }

    div.hint {
        margin-top: 1em;
        padding-left: 0.5em;
    }
`;