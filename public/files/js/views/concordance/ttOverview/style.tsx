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


// ----------- <FreqBar /> -----------------------

export const FreqBar = styled.div`

    &:not(:last-child) {
        margin-bottom: 0.7em;
    }

    .data {
        .item {
            display: inline-block;
            margin: 0;
            padding: 0;
            height: 0.7em;
        }
    }

    .legend {
        white-space: normal;
        display: inline-block;
        font-size: 0.9em;

        strong {
            margin-right: 0.7em;
        }

        .item .color-box {
            padding-right: 0.2em;
        }

        .item:not(:last-child) {
            padding-right: 0.7em;
        }
    }
`;
