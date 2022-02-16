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

import styled, { css } from 'styled-components';
import * as theme from '../../theme/default';

// ---------------------------------------------

const ChartH3 = css`

    margin: 0;
    padding-top: 0;
    padding-bottom: .2em;
    text-align: center;
    font-size: 1.6em;
    font-weight: normal;
    color: ${theme.colorLightText};
    letter-spacing: 0.1em;

`;

// ---------------- <FreqResultLoaderView /> ----------------------

export const FreqResultLoaderView = styled.div`

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 1px solid ${theme.colorLightFrame};
    border-radius: ${theme.borderRadiusDefault};
    height: 8em;
    width: 100%;

    &:not(:first-child) {
        margin-top: 1.5em;
    }

    h3 { ${ChartH3} }
`;

// ---------------- <FreqChartsView /> ---------------------------------

export const FreqChartsView = styled.div`
    max-width: 80em;

`;

// ---------------- <FreqChartsParamsFieldset /> -----------------------

export const FreqChartsParamsFieldset = styled.fieldset`

    > div {

        margin-bottom: 1em;

        > div.opts-line {

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

        }
    }
`;


// --------------- <FreqChartSection /> ------------------------------------

export const FreqChartSection = styled.section`

    padding: 1em;
    box-shadow: ${theme.portalBoxShadow};
    border-radius: ${theme.borderRadiusDefault};

    &:not(:first-child) {
        margin-top: 1.5em;
    }

    h3 {
       ${ChartH3}
    }

    .chart-wrapper {
        padding: 1em 0.7em;
    }

    .cloud-wrapper {
        padding-top: 2em;
        width: 70%;
        margin: 0 auto;
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


// ------------------- <ConfidenceIntervalHint /> --------------------------

export const ConfidenceIntervalHint = styled.div`

    h3 {
        font-weight: normal;
        font-size: 1.3em;
    }

    ul.references {

        li {
            line-height: 1.4em;
        }

        li a {
            margin-left: 0;
            text-decoration: none;
            color: ${theme.colorLogoBlue};
        }

        li a:hover {
            text-decoration: underline;
        }
    }
`;

// ----------------------- <FreqsHelp /> -------------------------------------

export const  FreqsHelp = styled.div`

    h2 {
        margin-left: 0;
        padding-left: 0;
        font-size: 1.5em;
    }

    h2:first-letter {
        text-transform: capitalize;
    }

`;