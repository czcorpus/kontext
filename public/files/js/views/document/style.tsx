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

// ---------------- <ModalOverlay /> --------------------------------------

export const ModalOverlay = styled.div`
    position: fixed;
    z-index: 5000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: RGBA(20, 20, 20, 0.70);

    > .tooltip-box, .closeable-frame {
        position: absolute;
        top: 30%;
        left: 50%;
        transform: translate(-50%,-30%);
    }

    > .tooltip-box {
        min-width: 70%;
        box-shadow: 3px 3px 4px #444;
        background-color: ${theme.colorSectionBg};
    }

    .tooltip-box.async-task-list {
        width: 90%;
        font-size: 0.8em;

        table {
            border-spacing: 0;

            td, th {
                text-align: left;
                padding: 0.3em 0.7em 0.3em 0.8em;
                border-color: ${theme.colorDefaultGreen};
                border-width: 0 1pt 0 0;
                border-style: solid;
            }

            td {
                min-width: 10em;
                max-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            td.status {
                width: 5%;
                img {
                    width: 1em;
                    margin-left: 0.4em;
                }
            }

            td.task-type {
                width: 15%;
            }

            td.label {
                width: 20%;
            }

            td.datetime {
                width: 15%;
            }

            td.msg {
                width: 45%;
            }

            th {
                color: ${theme.colorDefaultText};
                background-color: ${theme.colorDefaultGreen};
                font-weight: bold;
                padding-top: 1em;
                padding-bottom: 0.5em;
            }

            tr:nth-child(odd) {
                background-color: ${theme.colorLightGreen};
            }
        }

        div.options {
            margin-top: 1em;
            margin-bottom: 1em;
        }
    }

    .block-help {
        color: ${theme.colorDarkGreenText};

        .contents {
            h2 {
                margin-left: 0;
                margin-top: 1em;
                font-size: 1.5em;
            }

            h3 {
                margin-left: 0;
                font-size: 1.2em;
                color: ${theme.colorLogoPink};
                font-weight: normal;
            }

        }
    }
`;

// ---------------- <CloseableFrame /> --------------------------------------

export const CloseableFrame = styled.section`
    background-color: ${theme.colorSectionBg};
    border-radius: ${theme.borderRadiusDefault};
    box-shadow: ${theme.portalBoxShadow};
    max-width: 1280px;
    max-height: 90%;
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap;

    > .heading {
        padding: 0.6em 0.8em;
        background-color: ${theme.colorLightFrame};
        border-radius: 6px 6px 0 0;
        font-weight: normal;
        text-align: left;

        h2 {
            margin: 0 1.6em 0 0;
            padding: 0;
            display: block;
            text-align: left;
            width: 90%;
            font-size: 140%;
            font-weight: 300;
        }

        div.control {
            text-align: right;
            font-size: 1em;
            margin-right: 0;
            margin-top: 0.3em;
            float: right;

            img {
                width: 1em;
                height: 1em;
                cursor: pointer;
            }
        }
    }

    .contents {
        flex-grow: 1;

        .padded-contents {
            padding: 1.7em 1.4em 1em 1.4em;
        }
    }
`;
