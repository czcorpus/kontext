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
import * as theme from '../../../theme/default';

import warningIcon from '../../../../../img/warning-icon.svg';

// ---------------- <IntervalGroupVisualisation /> ---------------------------------

export const IntervalGroupVisualisation = styled.div`

    .grid line {
        stroke: lightgrey;
        stroke-opacity: 0.7;
        shape-rendering: crispEdges;
    }

    h2.top {
        text-align: center;
        padding-bottom: 0.7em;
    }

    .tooltip {
        position: absolute;
        background-color: ${theme.colorLogoBlue};
        color: #FFFFFF;
        box-shadow: ${theme.portalBoxShadow};
        border-radius: ${theme.inputBorderRadius};
        padding: 0.1em 1em;
        opacity: 0.4;
    }

    .chart-help {

        width: 40em;

        img {
            display: inline-block;
            padding-right: 0.3em;
            vertical-align: top;
        }
    }
`;

// ---------------- <CT2dFreqResultView /> ---------------------------------

export const CT2dFreqResultView = styled.div`

    table.ct-data {

        margin-top: 3em;
        border-spacing: 0;

        th {
            padding: 0.3em 0.7em;
            background-color: ${theme.colorDefaultGreen};
            font-weight: normal;
        }

        th.highlighted {
            color: ${theme.colorDefaultText};
            background-color: ${theme.colorGreenBgHighlighted};
        }

        th.vert.highlighted {
            span {

                padding: 0.3em 0.7em;
                display: inline-block;
            }
        }

        td a.visualisation {
            text-align: center;

            img {
                width: 1em;
            }
        }

        th a.visualisation-r {
            display: inline-block;
            margin-left: 0.7em;
            vertical-align: middle;

            img {
                width: 1em;
            }
        }

        td.icon {
            background-color: ${theme.colorDefaultGreen};
            text-align: center;
        }

        th a:hover {
            text-decoration: none;
        }

        th.vert {
            text-align: right;
        }

        td {
            border: 1px solid ${theme.colorLightFrame};
            padding: 0.3em 0.7em;
        }

        td.data-cell {
            text-align: right;

            a {
                display: inline-block;
                text-decoration: none;
            }

            a.conc {
                text-decoration: underline;
            }

            a:hover {
                text-decoration: underline;
            }

            .warn {
                float: left;
                font-weight: bold;
                background-image: url(${warningIcon});
                background-repeat: no-repeat;
                background-size: 1.1em 1.1em;
                width: 1.1em;
            }

            .menu {
                font-weight: normal;

                table {
                    td, th {
                        background-color: transparent;
                        border: none;
                    }

                    td input {
                        background-color: ${theme.colorBgLightBlue};
                        border: ${theme.inputBorderStyle};
                        border-radius: ${theme.inputBorderRadius};
                    }

                    td input.highlighted {
                        color: ${theme.colorLogoPink};
                        font-weight: normal;
                    }
                }
            }
        }

        td.data-cell.highlighted a {
            color: ${theme.colorDefaultText};
        }

        td.highlighted {
            background-color: ${theme.colorGreenBgHighlighted};
            color: #ffffff;
            font-weight: normal;
        }

        td.empty-cell {
            background-color: transparent;
        }

        th.attr-label {
            background-color: transparent;
            text-align: center;
            font-weight: bold;
            font-size: 110%;

            a {
                color: ${theme.colorDefaultText};
                text-decoration: none;
            }

            a:hover {
                text-decoration: underline;
            }
        }
    }

    .warning {

        max-width: 40em;

        img {
            display: inline-block;
            width: 1em;
            vertical-align: middle;
            margin-right: 0.3em;
        }
    }
`;

// --------------- <CTTableModForm /> ------------------------

export const CTTableModForm = styled.form`

    fieldset {
        margin-top: 0.7em;
        margin-bottom: 1.4em;
        line-height: 2.5em;
    }

    p, ul {
        line-height: normal;
    }
`;

// --------- <CTFreqResultView /> ----------------------------

export const CTFreqResultView = styled.div`

    margin: 1em;

    .mode-switch {

        text-align: center;
        font-size: 110%;

        a {
            color: ${theme.colorLogoBlue};
            text-decoration: none;
        }

        a:hover {
            text-decoration: underline;
        }

        a.current {
            text-decoration: underline;
        }
    }

    div.toolbar {
        margin-bottom: 1em;
    }

    sup.hint {
        img {
            width: 0.9em;
        }
        cursor: pointer;
    }
`;

// ------------------- <FieldsetBasicOptions /> -------------------

export const FieldsetBasicOptions = styled.div`
    a {
        margin-left: 0.7em;
        color: ${theme.colorLogoBlue};
        text-decoration: none;
    }

    a:hover {
        text-decoration: underline;
    }

    fieldset {

        h3:first-child {
            padding-top: 0;
            margin-top: 0;
        }
    }

    ul.items {
        list-style-type: none;
        margin: 0;
        padding: 0;

        > li {
            padding: 0;
            margin: 0 1em 0 0;
            display: inline-block;
        }
    }
`;

// ------------------- <ComboActionsSelectorUL /> -----------------

export const ComboActionsSelectorUL = styled.ul`

    list-style: none;
    margin: 0;
    padding: 0;

    li {
        display: inline-block;
        margin-right: 1em;
    }
`;
