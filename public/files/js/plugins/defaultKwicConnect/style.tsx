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

export const KwicConnectContainer = styled.div`

    .contents {
        max-height: 40em;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .loader {
        text-align: center;
        padding: 1em;
    }

    h3.tckc-provider {
        color: ${theme.colorDefaultText};
        text-align: right;
        margin-top: 1em;
        margin-bottom: 0;
        padding-bottom: 0.2em;
        font-size: 1.1em;
        background-color: transparent;

        img {
            width: 1.1em;
            margin-left: 0.3em;
            margin-right: 0.1em;
            margin-bottom: 0.15em;
            display: inline-block;
            vertical-align: middle;
        }
    }


    table {
        th {
            text-align: left;
        }
    }

    .not-found {
        color: #cccccc;
    }

    .provider-block {
        margin-top: 0.1em;

        .base-word {
            font-size: 1.3em;
            font-weight: normal;
            padding-right: 0.3em;
            color: ${theme.colorLogoPink};
        }

        .words {

            padding-right: 0.7em;

            a.word {
                text-decoration: none;
            }

            a.word:hover {
                text-decoration: underline;
                color: ${theme.colorLogoPink};
            }
        }


        .view-in-treq {
            line-height: 1.5em;
            display: inline;
            text-align: center;

            .util-button {
                font-size: 0.8em;
            }
        }
    }
`;
