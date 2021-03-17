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

export const CorpTreeWidget = styled.div`

    ul.corp-tree {
        margin: 0;
        padding: 1em;
        background-color: #FFFFFF;
        position: absolute;
        box-shadow: ${theme.portalBoxShadow};
        list-style-type: none;

        ul {
            list-style-type: none;
            margin: 0;
            padding: 0;
        }

        li {
            padding: 0 0 0 2em;
            margin: 0;
        }

        li.node a {
            text-decoration: none;
            color: ${theme.colorLogoBlue};
        }

        li.node a:hover {
            text-decoration: underline;
        }

        li.leaf a {
            color: ${theme.colorDefaultText};;
            text-decoration: none;
        }

        li.leaf a:hover {
            text-decoration: underline;
        }

        img.state-flag {
            padding-right: 0.4em;
        }
    }
`;

export const CorpTreeComponent = styled.div`
    ul.corp-tree {
        font-size: 120%;
        margin: 0;
        padding: 1em;
        background-color: transparent;
        position: static;
        list-style-type: none;

        ul {
            list-style-type: none;
            margin: 0;
            padding: 0;
        }

        li {
            padding: 0 0 0 1em;
            margin: 0;
        }

        li.node a {
            display: block;
            text-decoration: none;
            color: ${theme.colorLogoBlue};;
        }

        li.node > a {
            border: 1px solid ${theme.colorLightText};
            padding: 0.4em 0.6em;
            margin-bottom: 0.3em;
        }

        li.node a:hover {
            text-decoration: underline;
        }

        li.leaf > a {
            color: ${theme.colorDefaultText};;
            text-decoration: none;
            padding: 0.4em 0.6em;
        }

        li.leaf a:hover {
            text-decoration: underline;
        }

        img.state-flag {
            padding-right: 0.4em;
        }
    }
`;