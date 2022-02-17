/*
 * Copyright (c) 2022 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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

// ---------------- <FreqDispersionSection /> -----------------------

export const FreqDispersionSection = styled.section`

`;

// ---------------- <FreqDispersionParamFieldset /> -----------------------

export const FreqDispersionParamFieldset = styled.fieldset`
    display: flex;
    align-items: center;
    padding-left: 1em;
    padding-top: 1em;

    label {
        margin-right: 0.5em;
    }

    label:first-letter {
        text-transform: capitalize;
    }

    label:not(:first-of-type) {
        margin-left: 1.2em;
    }

`;

// --------------- <DownloadButton /> ------------------------------------

export const DownloadButton = styled.img`
    width: 1.2em;
    height: 1.2em;
    vertical-align: 'middle';
    margin: 0 0 0 0.5em;
    cursor: pointer;

`;
