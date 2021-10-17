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
import * as theme from '../../views/theme/default';

// ---------------- <LiveAttributesControlsUL /> ---------------

export const LiveAttributesControlsUL = styled.ul`
    grid-row-start: 1;
`;

// --------------- <LiveAttributesSteps /> --------------

export const LiveAttributesSteps = styled.div`

    margin: 0.7em 0 0.7em 0;
    grid-row-start: 2;
    grid-column: 1 / 4;
    text-align: left;
    display: flex;
    align-content: center;

    .step-block {
        margin-top: 0.6em;
        display: inline-block;
    }

    .step-block:not(:first-child) {
        margin-left: 0.3em;
    }

    span.arrow {
        display: inline-block;
        vertical-align: middle;
        color: ${theme.colorWidgetOrange};
    }

    table.step {
        min-height: 3.5em;
        border-spacing: 0;
        border: 1px solid ${theme.colorWidgetOrange};
        border-radius: ${theme.borderRadiusDefault};
        box-shadow: ${theme.portalBoxShadow};
        background-color: #FFFFFF;
    }

    table.step .num {
        background-color: ${theme.colorWidgetOrange};
        color: #FFFFFF;
        padding: 8px;
    }

    table.step .data {
        padding: 4px 8px;
    }
`;

// ----------------- <MinimizedTTBoxNote /> --------------

export const MinimizedTTBoxNote = styled.div`

    color: ${theme.colorLightText};
    white-space: normal;
    font-size: 0.8em;
    padding: 0.4em 1.4em;

    p {
        max-width: 24em;
        padding: 0;
        margin: 0.4em 0 0 0;
    }

`;


export const CustomizedDataRows = styled.div`

    td, th {
        padding: 0.4em 1em;
    }

`;