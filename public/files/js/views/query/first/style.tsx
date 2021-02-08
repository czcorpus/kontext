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

export const QueryForm = styled.form`

    margin: 1.5em;
    display: flex;
    flex-direction: column;

    .primary-language,
    .AlignedCorpora .AlignedCorpBlock .form {

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

    .AlignedCorpBlock {

        margin-left: 2.5em;

        table.form {
            margin: 5px 10px;
        }

        .heading {

            border: 1px solid #C7E7B2;
            background-color: ${theme.colorLightFrame};
            padding: 0.2em 1em;
            border-radius: ${theme.borderRadiusDefault};
            margin: 1em 0 1em 0;

            .icons {
                float: right;

                a {
                    display: inline-block;

                    img {
                        width: 1em;
                        vertical-align: middle;
                    }
                }

                a:not(:last-child) {
                    margin-right: 0.7em;
                }

                a.make-primary img {
                    margin-bottom: 0.1em;
                }
            }

            h3 {
                display: inline-block;
                font-weight: normal;
                margin: 0;
            }
        }

        .close-button {

            float: right;
            padding: 0;
            margin-right: 0;

            img {
                display: inline-block;
                vertical-align: middle;
                width: 1em;
            }
        }
    }

    .AdvancedFormFieldset.closed,
    .AlignedCorpora.closed {
        padding-bottom: 0;

        .contents {
            margin: 0;
            padding: 0;
        }
    }

    .AlignedCorpora,
    .SelectedTextTypesLite {


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

    .specify-context {

        h3 {
            font-weight: bold;
            margin-left: 0;
            margin-top: 0.7em;
            margin-bottom: 0.3em;
            font-size: 1.3em;
            letter-spacing: 0.06em;
        }

        .pos-filter {
            margin-top: 3em;

            .pos-list {
                ul {
                    padding-left: 0em;
                    list-style-type: none;

                    li {
                        margin: 0.4em 0;
                    }
                }
            }

            .ToggleSwitch {
                font-size: 1.3em;
                margin-right: 0.4em;
            }
        }

        dl.form {
            margin-bottom: 2.5em;

            dd {
                display: flex;
                align-items: center;

                .all-any-none-sel {
                    display: flex;
                    flex-direction: row;
                    height: 100%;
                }
            }

            dt:not(:first-of-type) {
                padding-top: 1em;
            }

            dt {
                font-weight: normal;
                padding-bottom: 0.3em;
            }

            .fc_lemword {
                width: 25em;
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