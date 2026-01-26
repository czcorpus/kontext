/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Department of Linguistics
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

import { styled } from 'styled-components';
import * as theme from '../../theme/default/index.js';

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

    .tooltip-box.conc-detail {
        max-width: 40em;
        min-width: 30em;
        max-height: 80%;
    }

    .tooltip-box.refs-detail {
        min-width: 40em;
        max-height: 80%;
        display: flex;
        justify-content: center;
        overflow: auto;
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

export const ShareConcordance = styled.a`
    margin: 0;
    padding: 0;
    text-decoration: none;
    display: flex;
    align-items: center;
    color: ${theme.colorLogoBlue};

    img {
        width: 0.8em;
        margin-right: 0.3em;
    }
`;

// ----------------- <ConcSummary /> ------------------

export const ConcSummary = styled.div`
    flex-grow: 3;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    font-size: 1em;
    font-family: ${theme.condensedFontFamily};

    #ipm-loader img {
        background-color: white;
        border-radius: 3px;
        padding: 3px 20px;
        opacity: 0.7;
        position: absolute;
    }

    .size-warning img {
        display: block;
        width: 1em;
        margin-right: 0.2em;
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

    .transient {
        display: flex;
        vertical-align: center;
        height: 1em;
        margin-right: 0.2em;

        img {
            display: block;
            width: 1em;
            height: 1em;
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

`;

// ---------------- <ConcToolbarWrapper /> --------------

export const ConcToolbarWrapper = styled.div`

    display: flex;
    align-items: center;
    padding: 0.4em 1em;

    .ktx-pagination {

    }
`;

// -------- <LineSelectionOps /> -------------------

export const LineSelectionOps = styled.div`

    flex-grow: 1;
    display: flex;
    align-items: center;

    .lines-selection {
        white-space: nowrap;

        img {
            padding-left: 0.4em;
            vertical-align: middle;
            width: 1em;
        }
    }

    .kwic-warning img {
        display: block;
        width: 1em;
        margin-left: 0.4em;
    }

    .util-button {
        font-size: 0.9em;
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
`;

// ---------------- <WaitingForConc /> --------------------

export const WaitingForConc = styled.div`

    @keyframes blink {
        0%, 100% {
            opacity: 1;
        }
        50% {
            opacity: 0;
        }
    }

    margin: 5em;

    .loader {
        text-align: center;

        img {
            display: inline-block;
            margin: 2em;
        }

        .counter {
            color: ${theme.colorLogoPink};
        }
    }

    .cqlizer-note {

        display: flex;
        flex-direction: column;

        .timer {
            text-align: center;
            font-size: 1.5em;

            .counter {
                color: ${theme.colorLogoPink};
            }
        }

        .messages {

            display: flex;
            align-items: center;
            justify-content: center;

            .icon {

                display: flex;
                padding: 1em 2.5em 1em 1em;
                animation: blink 3s ease-in-out infinite;

                img {
                    display: block;
                    margin: 0;
                    padding: 0 0.2em 0 0;
                    width: 2.4em;
                }

                .excl {
                    font-size: 4em;
                    font-weight: bold;
                    color: ${theme.colorLogoBlue};
                }
            }

            .loader-icon {

                display: block;

                img {
                    display: block;
                    margin: 0;
                    padding: 0 2.1em 0 0;
                    width: 3em;
                }
            }

            p {
                font-size: 1.3em;
                max-width: 25em;
            }
        }
    }
`;

// ---------------- <ShareConcordanceWidget /> ------------

export const ShareConcordanceWidget = styled.div`

    h4 {
        margin: 0 0 0.4em 0;
    }

    .link {
        display: flex;
    }

    .copy-icon {
        margin-left: 0.2em;
    }

`;

// ---------------- <AttrMismatchModalContents /> --------------

export const AttrMismatchModalContents = styled.div`

    .attr-list {
        text-align: center;
        font-size: 130%;
    }

    button[type=button] {
        margin-right: 1em;
    }

    .buttons {
        padding-top: 1em;
    }


`;