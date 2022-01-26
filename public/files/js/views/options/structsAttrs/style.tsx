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
import * as theme from '../../theme/default';
import { CollMetricsSelection } from '../../coll/style';

// ---------------- <StructsAndAttrsForm /> --------------------------------------

export const StructsAndAttrsForm = styled.form`
    .struct-groups {

        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr 1fr;

        div.group {
            padding-left: 0.7em;
            display: flex;
            flex-direction: column;
            margin-bottom: 2em;

            .AttrList {
                flex-grow: 1;

                ul {
                    margin-top: 0.2em;
                    list-style-type: none;
                    margin-left: 0;
                    padding-left: 1.7em;

                    li label input {
                        vertical-align: middle;
                    }
                }
            }
        }

        div.group:not(:nth-child(5)) {
            border-color: ${theme.colorSuperlightText};
            border-width: 0 1px 0 0;
            border-style: solid;
            padding-right: 0.7em;
        }

        div.group:last-child {
            border-style: none;
        }

        label.struct {
            color: ${theme.colorLogoPink};
            font-size: 120%;

            input[type=checkbox] {
                display: inline-block;
                vertical-align: middle;
            }
        }
    }

    .select-all-structs-and-groups {
        margin-top: 1.5em;
        text-align: center;

        input {
            vertical-align: middle;
        }
    }

    .button-replace {
        padding: 0.3em 2em;
        background-color: transparent;
    }

    .warn {
        white-space: normal;
        width: initial;

        .icon {
            display: inline-block;
            padding-right: 0.3em;
            vertical-align: middle;

            img {
                width: 1.2em;
            }
        }
    }
`;


// ---------------- <AttributesTweaks /> --------------------------------------

export const AttributesTweaks = styled.div`
    margin-left: 1.5em;
    margin-bottom: 1.2em;

    h3 {
        margin-bottom: 0.4em;
    }

    ul.switch {
        list-style-type: none;
        margin: 0;
        padding: 0;

        li {

            margin: 0;
            padding: 0.2em 0;

            label {
                input,
                span {
                    vertical-align: middle;
                    display: inline-block;
                }
            }
        }
    }
`;


// ---------------- <Extensions /> --------------------------------------

export const Extensions = styled.div`

    margin-left: 1.5em;
    margin-bottom: 1.2em;

    h3 {
        margin-bottom: 0.4em;
    }

    ul.switch {
        margin-top: 2em;
    }

    .configured-items span.item {
        text-transform: lowercase;
    }

    ul {
        list-style-type: none;
        display: inline;

        li {
            display: inline;

            label {
                display: flex;

                input,
                span {
                    padding: 0;
                    margin: 0;
                    display: block;
                }

                input {
                    margin-right: 0.3em;
                }
            }
        }
    }
`;


// ---------------- <AttrSelection /> --------------------------------------

export const AttrSelection = styled(CollMetricsSelection)`
    margin-bottom: 1.3em;

    th.attr {
        color: ${theme.colorLogoPink};
    }

    td.warning {
        color: ${theme.colorLogoPink};
    }
`;


// ---------------- <AttributesCheckboxes /> --------------------------------------

export const AttributesCheckboxes = styled.div``;


// ---------------- <StructAttrsViewOptions /> ------------------------------------

export const StructAttrsViewOptions = styled.div`

    @media screen and (max-width: 479px) {

        .struct-groups {
            grid-template-columns: 1fr 1fr;
        }

        .struct-groups div.group:nth-child(2) {
            border-style: none;
        }
    }
`;
