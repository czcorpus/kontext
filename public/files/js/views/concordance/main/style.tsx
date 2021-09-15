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

// ----------- <ConcordanceDashboard /> -----------------------

export const ConcordanceDashboard = styled.div`

    display: grid;
    align-items: flex-start;
    grid-template-columns: minmax(auto, 24em) auto;
    grid-column-gap: 1em;

    &.collapsed {
        grid-template-columns: 1.5em auto;
        grid-column-gap: 0.5em;

        .ConcExtendedInfo {

            border-radius: 3px;

            header {
                padding: 0;

                a {
                    display: block;
                    margin: 0 auto;
                }
            }
        }
    }

    &.disabled {
        grid-template-columns: auto;
    }

`;

// ----------- <ConcordanceView /> -----------------------

export const ConcordanceView = styled.div`

    overflow: hidden;
    border-radius: 7px;
    margin-bottom: 1em;
    margin-top: 1em;
    box-shadow: ${theme.portalBoxShadow};

    > .contents {

        margin: 1em;

        .loader {
            text-align: center;
        }
    }
`;

// ----------- <ConcVerticalBar /> -----------------------

const ConcVerticalBar = styled.div`

    background-color: ${theme.colorDefaultGreen};

    .info-level {
        padding: 0.4em 1em;
        display: flex;
        align-items: center;

        .conc-size.unfinished,
        .ipm.unfinished {
            color: ${theme.colorLightText};
        }

        .result-info {
            flex-grow: 3;
            margin: 0;
            font-size: 1em;
            font-family: ${theme.condensedFontFamily};

            #ipm-loader img {
                background-color: white;
                border-radius: 3px;
                padding: 3px 20px;
                opacity: 0.7;
                position: absolute;
            }

            .ipm {
                font-weight: bold;
            }

            sup {
                vertical-align: middle;
                top: -0.4em;
                padding-left: 0.2em;
            }

            .notice-shuffled {
                white-space: nowrap;
            }

            .ipm-note img {
                display: inline-block;
                width: 1em;
                vertical-align: middle;
                margin-right: 0.3em;
                margin-left: 0.1em;
            }
        }

        .conc-loader {
            display: inline-block;
            vertical-align: middle;
            padding-right: 0.2em;

            img {
                display: inline-block;
                width: 16px;
            }
        }
    }
`;

// ----------- <ConcTopBar /> -----------------------

export const ConcTopBar = styled(ConcVerticalBar)`

    padding: 0.3em 0 0 0;

    .info-level::after {
        content: "";
        display: block;
        clear: both;
    }

    span.separ {
        font-size: 120%;
        font-weight: normal;
        color: #00A8E8;
        padding-left: 0.3em;
        padding-right: 0.3em;
        vertical-align: middle;
    }

    .selection-mode-switch {
        vertical-align: middle;
    }

    .toolbar-level {

        padding: 0.4em 1em;
        clear: both;

        .conc-toolbar {
            display: inline-block;
        }
    }

`;

// -------- <LineSelectionOps /> -------------------

export const LineSelectionOps = styled.div`

    display: inline-block;

    .lines-selection {
        white-space: nowrap;

        img {
            padding-left: 0.4em;
            vertical-align: middle;
            width: 1em;
        }
    }
`;


// ----------- <ConcBottomBar /> --------------------

export const ConcBottomBar = styled(ConcVerticalBar)`

    padding: 0.3em 0 0.3em 0;

    .info-level::after {
        content: "";
        display: block;
        clear: both;
    }

    &.minimized {
        padding: 0px 20px;
    }
`;


// -------------- <ConclinesWrapper /> -----------------

export const ConclinesWrapper = styled.div`

    overflow: auto;
    background-color: #FFFFFF;
    position: relative; // to prevent audio-player x-position mismatch

    img.loader-anim {
        display: block;
        width: 24px;
        height: 24px;
        margin: 2em auto 2em auto;
    }

    .no-data {
        text-align: center;

        img {
            display: inline-block;
            margin: 2em;
        }
    }
`;