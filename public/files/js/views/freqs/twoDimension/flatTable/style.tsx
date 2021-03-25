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

import warningIcon from '../../../../../img/warning-icon.svg';


// ---------------- <CTFlatFreqResultView /> ---------------------

export const CTFlatFreqResultView = styled.div`

    th.sort-col {

        white-space: nowrap;

        a {
            text-decoration: underline;

            img {
                margin-left: 0.7em;
            }
        }

        a:hover {
            text-decoration: none;
        }

    }

    td strong.warn {
        float: left;
        font-weight: bold;
        background-image: url(${warningIcon});
        background-repeat: no-repeat;
        background-size: 1.1em 1.1em;
        width: 1.1em;
    }
`;
