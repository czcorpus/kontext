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


// ---------------- <WordlistResult /> --------------------------------------

export const WordlistResult = styled.div`

    .ktx-pagination {
        text-align: right;
        padding: 0.7em;

        form {
            display: inline-block;
        }
    }

    .data {
        margin: 1em;
    }

    .no-result {
        margin: 1em;
        padding-top: 2em;
        padding-bottom: 2em;
        font-size: 120%;
    }
`;


// -------------------- <CalculationStatus /> -----------------------------

export const CalculationStatus = styled.div`

    margin: 1em;

    p.calc-info {

        img.icon {
            width: 1em;
            display: inline-block;
            margin-right: 0.3em;
        }

        width: 30em;
        text-align: justify;
    }

    .processbar-wrapper {

        border-width: 1px;
        border-radius: ${theme.borderRadiusDefault};
        border-style: solid;
        border-color: ${theme.colorLightPink};
        width: 5em;

        .processbar {
            background-color: ${theme.colorLogoPink};
            height: 1em;
        }
    }
`;