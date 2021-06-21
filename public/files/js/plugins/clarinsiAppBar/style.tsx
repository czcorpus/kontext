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

// -------------- <Widget /> -----------------------

export const Widget = styled.div`

    background-color: #FFFFFF;
    color: #000000;
    border-bottom: 3px solid #ccab28;
    background-color: #f0f0f0;

    .buttons {
        padding-top: 0;
    }

    @media (max-width: 768px) {

        .buttons {
            position: absolute;
            top: 0;
            left: 0;
        }

        align-items: flex-start;
    }

    .selected img {
        border: 2px solid rgb(102, 175, 233) !important;
    }
`;


// -------------- <LocalizationBar /> -----------------------

export const LocalizationBar = styled.ul`

    position: absolute;
    list-style-type: none;
    display: flex;
    align-items: center;
    top: 6px;
    left: 15px;
    margin: 0;
    padding: 0;

    li {
        height: 24px;
        display: flex;
        align-items: center;

        a {
            img {
                display: block;
            }
        }
    }

    li:not(:last-child) {
        margin-right: 0.5em;
    }
`;

// -------------- <Navigation /> ----------------------------

export const Navigation = styled.nav`

    display: flex;
    justify-content: center;
    height: 100%;

    a {
        color: #000000;
    }

    .lindat-common {
        font-family: Droid Sans, Helvetica, Arial, sans-serif;
        box-sizing: border-box;
        font-size: 14px
    }

    .lindat-common *, .lindat-common :after, .lindat-common :before {
        box-sizing: inherit
    }

    @media (max-width: 768px) {
        margin-top: 2em;
        margin-right: 0;
        justify-content: flex-start;
        flex-direction: column;
    }

    @media (min-width: 768px) {
        .lindat-logo {
            background:url('data:image/png;base64,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') no-repeat 50%;
            min-width: 100px
        }

        .lindat-logo > span {
            display:none
        }

        .clarin-logo {
            background:url('data:image/png;base64,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') no-repeat 50%;
            min-width: 100px
        }

        .clarin-logo > span {
            display: none;
        }
    }
`;

// ----------------- <Menu /> ---------------------------------

export const Menu = styled.ul`

    margin: 0;
    padding: 0;
    display: none;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: center;
    align-items: stretch;
    list-style-type: none;

    &.lindat-open {
        display: flex;
        flex-direction: column;
    }

    > li {
        display: block;
    }

    > li > a {
        height: 100%;
        text-decoration: none;
        padding: 10px 15px;
        font-size: 16px;
        display: flex;
        align-items: center;
        color: #000;
    }

    > li > a:hover {
        outline: 0;
    }

    @media (min-width: 768px) {
        margin-top: 0;
        height: 53px;
        display: flex;

        > li {
            border-right: 1px dotted #e4e4e4;
        }

        > li > a {
            display: flex;
            align-items: center;
            font-size: 14px;
            padding: 0 15px;
            font-weight: bolder;
            text-align: center;
            border-bottom: 3px solid transparent;
        }

        > li > a:hover {
            outline: 0;
            border-bottom-color: #ccab28;
        }
    }

    @media (max-width: 768px) {
        > li > a:hover {
            background-color: #d7d7d7;
        }
    }

`;

// --------------------- <MenuButton /> --------------------------

export const MenuButton = styled.button`

    width: 2.5em;
    height: 2.5em;
    margin: 5px 14px;
    background-color: transparent;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    outline: none;

    .lindat-icon-bar+.lindat-icon-bar {
        margin-top: 4px
    }

    .lindat-icon-bar {
        display: block;
        width: 22px;
        height: 2px;
        border-radius: 1px;
        background-color: #ccc
    }

    @media (min-width: 768px) {
        display: none;
    }
`;