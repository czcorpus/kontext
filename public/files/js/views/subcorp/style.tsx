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
import * as theme from '../theme/default';

// ---------------- <SubcorpForm /> --------------------------------------

export const SubcorpForm = styled.form`
    p.note {
        margin: 0.3em;
    }

    .data-sel {
        margin-top: 1.6em;
    }
`;

// ---------------- <TRWithinBuilderWrapper /> --------------------------------------

export const TRWithinBuilderWrapper = styled.div`
    .WithinBuilder {
        margin-top: 1em;
        margin-bottom: 1em;
    }

    .button-row td {
        padding-top: 0.7em;
    }

    tr.within-rel {
        font-size: 1em;
        font-weight: normal;
        color: ${theme.colorLightText};
        white-space: nowrap;

        td {
            padding-top: 1em;
        }

        .set-desc {
            background-color: #FFFFFF;
            border-radius: ${theme.inputBorderRadius};
            color: ${theme.colorLightText};
            padding-right: 0.6em;
        }

        .line-id {
            text-align: right;
            font-weight: bold;
            font-size: 120%;
            color: ${theme.colorLogoPink};
            padding-right: 0.4em;
        }
    }

    td {
        padding: 0;
    }

    td > * {
        vertical-align: middle;
    }

    td > sup {
        vertical-align: top;
    }

    .negation {
        padding: 0.1em 0.4em;
        font-weight: bold;
    }

    .remove-line {
        cursor: pointer;
        width: 1em;
        margin-left: 0.2em;
    }

    .code {
        font-family: ${theme.monospaceFontFamily};
    }

    td.container tr.last-line td {
        padding-top: 0.4em;
    }

    td.container tr.last-line .add-within:hover {
        background-color: ${theme.colorLogoBlueShining};
    }
`;

// ---------------- <SubcorpList /> --------------------------------------

export const SubcorpList = styled.div`
    .ActionMenu {
        display: inline-block;
        list-style-type: none;
        margin: 0;
        padding: 0;

        li {
            display: inline-block;
            margin: 0;
            padding: 0;
        }

        li:not(last-child) {
            margin-right: 0.7em;
        }
    }
`;

// ---------------- <ListPublic /> --------------------------------------

export const ListPublic = styled.div`

    margin-top: 1em;

    fieldset.Filter {

        border: none;

        label {
            display :inline-block;
        }

        input[type="text"] {
            font-size: 1.5em;
        }

        .CodePrefixInput {
            font-size: 120%;
        }

        p.note {
            margin-bottom: 0;
        }
    }

    .disclaimer {

        max-width: 50em;
        padding: 0.7em;

        img {
            display: inline-block;
            width: 1em;
            vertical-align: middle;
            margin-right: 0.4em;
        }
    }

    .loader {
        background-color: ${theme.colorWhiteText};
        text-align: center;
        border: 1px solid ${theme.colorDefaultGreen};
        padding: 0.7em 1em 0.3em 1em;

        img {
            display: inline-block;
        }
    }

    .DataList {

        margin: 0;
        padding: 0;
        list-style-type: none;
        border: 1px solid ${theme.colorDefaultGreen};
        background-color: ${theme.colorWhiteText};

        .no-result {
            text-align: center;
        }

        li.DataRow {

            margin: 0;
            padding: 0.7em 1em 0.3em 1em;

            button.use-in-query {
                float: right;
            }

            h3 {
                font-size: 1.3em;
                font-weight: normal;
                margin: 0 0 0.2em 0;

                .code {
                    color: ${theme.colorLightText};
                }
            }

            a.DetailExpandSwitch {
                display: inline-block;
                margin-top: 0.7em;
                text-decoration: none;
                color: ${theme.colorLightText};

                img {
                    vertical-align: middle;
                    display: inline-block;
                    margin-right: 0.2em;
                }
            }

            a.DetailExpandSwitch:hover {
                text-decoration: underline;
                color: ${theme.colorLogoPink};
            }

            table.props {

                th {
                    text-transform: lowercase;
                }
            }

            .description {
                font-family: ${theme.condensedFontFamily};
                margin-top: 0.7em;
                margin-left: 0.25em;
                margin-bottom: 0.7em;
                padding: 0.7em 1em;
                border-color: ${theme.colorLightText};
                border-style: dashed;
                border-width: 0 0 0 1px;
            }

        }

        li.DataRow:nth-child(2n) {
            background-color: ${theme.colorTableEvenBg};
        }

    }
`;