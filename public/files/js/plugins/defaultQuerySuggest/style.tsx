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


export const ErrorRenderer = styled.div`
    img.error-icon {
        display: inline-block;
        vertical-align: middle;
        width: 1.2em;
        margin-right: 0.4em;
    }

    p.gear {
        text-align: center;
    }
`;

export const BasicRenderer = styled.div`
    ul {
        margin: 0;
        padding: 0;
    }
`;

export const PosAttrPairRelRenderer = styled.div`
    table {
        margin-top: 0.7em;
        border-spacing: 0;
        border-collapse: collapse;

        thead tr th {
            border-width: 0 0 1px 0;
            text-align: left;
        }

        td, th {
            padding: 0.2em 0.4em;
        }

        th {
            border: 1px solid ${theme.colorLightGrey};
        }

        th.attr1 {
            font-weight: normal;
            font-size: 120%;
            border-width: 0 1px 0 0;
        }

        tr.separ {
            td, th {
                border-top-width: 1px;
                border-top-color: ${theme.colorLightGrey};
                border-top-style: solid;
            }

            a {
                color: ${theme.colorLogoBlue};
                text-decoration: none;
            }

            a:hover {
                color: ${theme.colorLogoBlue};
                text-decoration: underline;
            }
        }
    }

    .note {
        display: flex;
        align-items: center;
        padding: 0.3em 0.7em;

        .icon-box {
            width: 1.2em;
            margin-right: 0.4em;

            img {
                width: 1.2em;
                display: block;
            }
        }
    }
`;
