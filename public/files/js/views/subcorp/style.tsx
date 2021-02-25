/*
 * Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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
import * as theme from '../theme/default';

// ---------------- <SubcorpForm /> --------------------------------------

export const SubcorpForm = styled.form`
    p.note {
        margin: 0.3em;
    }

    .data-sel {
        margin-top: 1.6em;
    }
`;

// ---------------- <TRWithinBuilderWrapper /> --------------------------------------

export const TRWithinBuilderWrapper = styled.div`
    .WithinBuilder {
        margin-top: 1em;
        margin-bottom: 1em;
    }

    .button-row td {
        padding-top: 0.7em;
    }

    tr.within-rel {
        font-size: 1em;
        font-weight: normal;
        color: ${theme.colorLightText};
        white-space: nowrap;

        td {
            padding-top: 1em;
        }

        .set-desc {
            background-color: #FFFFFF;
            border-radius: ${theme.inputBorderRadius};
            color: ${theme.colorLightText};
            padding-right: 0.6em;
        }

        .line-id {
            text-align: right;
            font-weight: bold;
            font-size: 120%;
            color: ${theme.colorLogoPink};
            padding-right: 0.4em;
        }
    }

    td {
        padding: 0;
    }

    td > * {
        vertical-align: middle;
    }

    td > sup {
        vertical-align: top;
    }

    .negation {
        padding: 0.1em 0.4em;
        font-weight: bold;
    }

    .remove-line {
        cursor: pointer;
        width: 1em;
        margin-left: 0.2em;
    }

    .code {
        font-family: ${theme.monospaceFontFamily};
    }

    td.container tr.last-line td {
        padding-top: 0.4em;
    }

    td.container tr.last-line .add-within:hover {
        background-color: ${theme.colorLogoBlueShining};
    }
`;
