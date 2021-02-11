/*
 * Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
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
import * as theme from '../theme/default';

const externalLinkImg = require('../../../img/external-link.png').default;

// ----------- <TextTypesPanel /> ----------------------------

export const TextTypesPanel = styled.div`

    .grid {

        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        grid-gap: 1.4em 0.7em;

        ${theme.mediaPhone} {
            grid-template-columns: 1fr;
        }

        .TableTextTypeAttribute {

            background-color: #FFFFFF;
            border: solid 1px ${theme.colorLightFrame};
            border-radius: ${theme.borderRadiusDefault};
            margin: 0;
            padding: 0;
            width: 100%;
            display: inline-block;

            > div {
                margin: 0;
            }

            > .range, > .data-rows {
                padding-top: 0.4em;
                padding-left: 1em;
            }

            .textTypes_RawInputContainer {
                padding-top: 0.7em;
                padding-bottom: 0.7em;
            }

            div.attrib-name {

                background-color: ${theme.colorDataTableFooter};
                display: flex;
                flex-direction: row;
                align-items: center;

                h3 {
                    padding: 0.6em 1em;
                    margin: 0;
                    flex-grow: 1;

                    .ajax-loader {
                        margin-left: .7em;
                    }

                    span.info-link {

                        font-size: 0.9em;
                        color: ${theme.colorLightText};

                        a {
                            font-weight: normal;
                            background-image: url(${externalLinkImg});
                            background-repeat: no-repeat;
                            background-position: 100% 0;
                            padding-right: 12px;
                            color: ${theme.colorLightText};
                            text-decoration: none;
                        }

                        a:hover {
                            text-decoration: underline;
                        }
                    }
                }

                h3.focused {
                    color: ${theme.colorLogoPink};
                }

                .textTypes_TextTypeAttributeMinIcon {

                    flex-basis: auto;
                    padding: 0.3em 1em;

                    a {
                        vertical-align: middle;
                        display: inline-block;

                        img {
                            width: 1em;
                        }
                    }
                }
            }

            div.last-line {
                background-color: ${theme.colorDataTableFooter};
                padding: 0.4em;
                overflow: hidden;

                label.select-all {
                    color: ${theme.colorLogoBlue};
                }

                .select-mode {
                    float: right;
                }
            }

            table.FullListContainer {
                border-spacing: 0;

                td, th {
                    padding: 0.4em 1em;
                }

                td:first-child {
                    padding-left: 0;
                }

                td input[type='checkbox'] {
                    vertical-align: middle;
                }

                label {
                    max-width: 20em;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: inline-block;
                    white-space: nowrap;
                }
            }

            input[type="text"] {
                width: 15em;
            }

            .extended-info {
                width: 1.4em;
                height: 1.4em;
            }

            .ValueSelector {
                display: block;
                overflow-x: hidden;
                overflow-y: auto;
                width: 100%;
                max-height: 300px;
            }

            .excluded {
                display: none;
            }

            .ValueSelector ul.auto-complete {
                position: absolute;
                list-style-type: none;
                max-height: 15em;
                overflow-y: auto;
                overflow-x: hidden;
                margin: 0;
                padding: 0;
                background-color: #FFFFFF;
                box-shadow: ${theme.portalBoxShadow};
                border: 1px solid ${theme.colorDefaultGreen};

                li {
                    padding: 0.3em 0.7em;
                    margin: 0;

                    a {
                        text-decoration: none;
                    }
                }
            }

            .metadata {
                font-size: 80%;
                color: ${theme.colorLightText};
                text-align: center;
            }


            .range-selector {
                padding: 5px 8px 5px 12px;

                div {
                    padding: 0.3em 0;
                }

                h3 {
                    margin: 1em 0;
                }

                label.date {
                    font-weight: bold;
                }

                div.interval-switch select {
                    display: iinline-block;
                    vertical-align: middle;
                }

                div.interval-switch .label {
                    display: inline-block;
                    vertical-align: middle;
                }

                .confirm-range {
                    margin-top: 1em;
                }
            }

            .define-range {
                color: ${theme.colorLogoBlue};
                text-align: center;
            }


            .TableTextTypeAttribute.locked .define-range {
                a {
                    color: ${theme.colorLightText};
                }

                a.locked,
                a.locked:hover {
                    color: ${theme.colorLightText};
                    text-decoration: line-through;
                    cursor: default;
                    background-color: transparent;
                }
            }

            .CalendarDaysSelector {

                .calendars {
                    display: flex;
                    margin-bottom: 0.7em;

                    > div:not(:first-child) {
                        margin-left: 1em;
                    }
                }

                p.info {
                    max-width: 25em;
                    font-size: 0.9em;
                    padding-right: 1em;
                }
            }
        }

        .TableTextTypeAttribute.aligned {

            div {
                input[type="checkbox"] {
                    padding-left: 1em;
                }
            }

            .note {
                p {
                    max-width: 17em;
                    padding: 0;
                    margin: 0.4em 0 0 0;
                }
                color: ${theme.colorLightText};
                white-space: normal;
                font-size: 0.8em;
                padding: 0.4em 1em;
            }
        }

        .TableTextTypeAttribute.locked {
            border: 1px solid ${theme.colorLockedAttrsBgColor};

            > .attrib-name {
                background-color: ${theme.colorLockedAttrsBgColor};
            }

            > .last-line {
                background-color: ${theme.colorLockedAttrsBgColor};
            }
        }

        a.bib-info, a.bib-warn {
            display: inline-block;
            text-align: center;
            width: 0.8em;
            font-family: serif;
            font-size: 1em;
            font-weight: bold;
            border-radius: 2px;
            text-decoration: none;
        }

        a.bib-info {
            color: #FFFFFF;
            background-color: ${theme.colorLogoBlue};
            border: 1px solid ${theme.colorLogoBlue};
        }

        a.bib-info:hover {
            color: ${theme.colorLogoBlue};
            background-color: #FFFFFF;
        }

        a.bib-warn {
            color: #FFFFFF;
            background-color: ${theme.colorLogoOrange};
            border: 1px solid ${theme.colorLogoOrange};
        }
    }
`;