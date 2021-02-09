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
import * as theme from '../../theme/default';

// ---------------- <QueryForm /> --------------------------------------

export const QueryForm = styled.form`

    margin: 1.5em;
    display: flex;
    flex-direction: column;

    .primary-language {

        > *:not(:first-child) {
            margin-top: 1em;
        }

        .query {
            max-width: 60em;
            margin-top: 2.7em;
        }

        .FilterTypeSelector {
            margin-bottom: 1.3em;
        }
    }

    .query-options {
        .default-attr-selection .sel {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;

            span {
                flex-grow: 1;
            }

            .tagset-summary {
                display: block;
                text-align: right;
                color: ${theme.colorLightText};
                padding-top: 0.3em;

                a {
                    color: ${theme.colorLightText};
                    display: inline-block;
                    padding-right: 0.9em;
                }
            }
        }
    }

    ${theme.mediaPhone} {

        margin: 1em;

        .primary-language,
        .AlignedCorpora .AlignedCorpBlock .form {
            max-width: auto;
        }

        .TextTypesPanel {

            .grid {
                grid-template-columns: 1fr;
            }
        }
    }
`;


export const QueryHelp = styled.div`
    #modal-overlay {

        h2::first-letter {
            text-transform: capitalize;
        }

        h3 {
            color: ${theme.colorDefaultText};
            margin: 0.5em 0 0.5em 0;
        }

        ul.tagset-links {
            margin: 0;
            padding: 0;
            list-style-type: none;

            li {
                padding: 0;

                dl {
                    padding: 0;

                    .attr {
                        color: ${theme.colorDefaultText};
                    }

                    dt {
                        padding: 0.3em;
                        display: inline-block;
                    }

                    dd {
                        display: inline-block;
                        margin-inline-start: 0.1em;
                    }

                    dd::after {
                        content: "\a";
                        white-space: pre;
                    }
                }
            }
        }
    }
`;