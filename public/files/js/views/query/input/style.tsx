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

import warningIconImg from '../../../../img/warning-icon.svg';
import tokenHighlightImg from '../../../../img/token_highlight.svg';
import configIconPink from '../../../../img/config-icon-pink.svg';

// -------------------- <AdvancedFormFieldsetDesc /> ---------------------------

export const AdvancedFormFieldsetDesc = styled.span`
    a {
        display: inline-block;
        vertical-align: middle;
        margin-left: 0.5em;

        img {
            width: 1em;
        }
    }

    .html-code {

        max-width: 40em;

        > div {
            text-align: justify;
            margin: 0.7em 1em;
        }
    }
`;

// --------------------- <AdvancedFormFieldset /> ------------------------------

export const AdvancedFormFieldset = styled.section`

    &.closed {
        padding-bottom: 0;

        .contents {
            margin: 0;
            padding: 0;
        }
    }

    padding: 0.2em 0 1.6em 0;

    .contents {
        padding: 1.1em 1.5em;
        border-radius: 5px;
        border-color: ${theme.colorLightFrame};
        border-width: 0.1em;
        border-style: solid;
    }

    .desc p {
        margin: 0 20pt;
        font-size: 80%;
        color: ${theme.colorLightText};
        background-image: url(${warningIconImg});
        background-repeat: no-repeat;
        background-size: 1.5em 1.5em;
        line-height: 1.5;
    }

    .desc p:first-letter {
        padding-left: 17pt;
    }

    .desc a {
        color: ${theme.colorLightText};
    }

    &.query-options {

        margin-top: 1.8em;

        .ToggleSwitch {
            margin-left: 0.3em;
            font-size: 1.3em;
        }

        div.options {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            grid-template-rows: auto;
            grid-gap: 1em;
            grid-row-gap: 1.5em;
            align-items: baseline;

            div.option {
                white-space: nowrap;
                margin-right: 1.3em;
                display: flex;
                align-items: center;

                label {

                    input {
                        display: inline-block;
                        vertical-align: middle;
                    }
                }
            }

            div.option:not(:last-of-type) {
                margin-right: 0;
            }

            div.option.disabled {
                color: ${theme.colorLightText};
            }

            div.option.custom div.option {
                grid-column-start: 1;
            }
        }
    }

    &.specify-context {

        h3 {
            font-weight: bold;
            margin-left: 0;
            margin-top: 0.7em;
            margin-bottom: 0.3em;
            font-size: 1.3em;
            letter-spacing: 0.06em;
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

        .query-options {
            div.options {
                grid-template-columns: 1fr;

                div.option {
                    select {
                        width: 10em;
                    }
                }
            }
        }
    }
`;

// --------------------- <AlignedCorpora /> ----------------------------

export const AlignedCorpora = styled(AdvancedFormFieldset);

// --------------------- <SelectedTextTypesLite /> ----------------------------

export const SelectedTextTypesLite = styled(AdvancedFormFieldset)`
    font-size: 1.1em;

    ul {
        white-space: initial;
        list-style-type: none;
        margin: 0;
        padding: 0;

        li {
            margin: 0;
            padding: 0;

            .attr-val {
                color: ${theme.colorLogoGreen};
            }
        }
    }
`;

// --------------------- <QueryHints /> ----------------------------

export const QueryHints = styled.div`

    white-space: initial;
    padding: 0.3em 0.7em;
    margin-top: 0.7em;
    background-color: #f9f9f9;
    border-style: solid;
    border-color: #fefefe;
    border-width: 0.15em;
    border-radius: 0.2em;
    color: ${theme.colorLightText};
    font-size: 0.9em;
    max-width: 50em;
    line-height: 1.5;

    .tip {
        text-transform: uppercase;
        color: ${theme.colorLogoBlue};
        font-weight: bold;
        padding-right: 0.7em;
    }

    .highlight {
        font-weight: bold;
    }

    > * {
        display: inline;
    }

    .next-hint {
        padding-left: 0.7em;
    }

    .next-hint a {
        color: ${theme.colorLogoBlue};
        text-decoration: none;
    }

    .next-hint a:hover {
        color: ${theme.colorLogoBlue};
    }
`;

// ------------------- <QueryToolbox /> --------------------------------

export const QueryToolbox = styled.div`
    position: relative;

    > ul {
        list-style-type: none;
        margin: 0;
        padding: 0.1em 0;
        background-color: ${theme.colorSectionBg};
        color: ${theme.colorLightText};
        display: flex;
        align-items: center;

        li {
            margin: 0.3em 0.55em;

            .notifications {
                color: ${theme.colorLogoPink};
                padding-left: 0.2em;
            }
        }

        li:not(:last-child) {
            border-style: solid;
            border-color: ${theme.colorLogoBlue};
            border-width: 0 1px 0 0;
            padding-right: 1em;
        }

        li:first-child:before {
            content: none;
        }

        li .hint strong {
            font-size: 100%;
            font-weight: normal;
            padding: 0;
            border: 1px solid ${theme.colorLightGrey};
            border-style: ${theme.borderRadiusDefault};
        }

        li a,
        li label {
            background-color: transparent;
            color: ${theme.colorLogoBlue};
            text-decoration: none;
        }

        li a:hover {
            color: ${theme.colorLogoBlue};
            text-decoration: underline;
        }

        a.highlighted {
            color: ${theme.colorLogoPink};
            font-weight: normal;
        }

        a.highlighted::after {
            content: " \u25C0 ";
        }
    }
`;

// ----------- <WithinWidget /> ----------------------------

export const WithinWidget = styled.div`

    input {
        width: 20em;
    }
    white-space: nowrap;
`;


// ----------- <QueryArea /> ----------------------------

export const QueryArea = styled.div`

    display: flex;
    flex-direction: column;
    margin-bottom: 0.4em;

    > textarea,
    pre.cql-input,
    > span.simple-input, input.simple-input {
        background-color: ${theme.colorWhiteText};
        padding: 0.5em 0.3em 0.3em 0.3em;
        border-style: solid;
        border-width: 0.05em;
        border-color: ${theme.colorLightFrame};
        border-radius: 0.2em;
        display: block;
        box-sizing: border-box;
        width: 100%;
        min-width: 40em;
    }

    > textarea:hover, > textarea:focus,
    pre.cql-input:hover, pre.cql-input:focus,
    > span.simple-input:hover, input.simple-input:hover,
    > span.simple-input:focus, input.simple-input:focus {
        box-shadow: 0 0 0 0.05em ${theme.colorLightFrame};
    }

    pre.cql-input {

        font-size: 1.3em;
        min-height: 5em;
        overflow: hidden;
        resize: vertical;
        padding: 0.5em 0.3em 0.3em 0.3em;

        .sh-regexp {
            color: #920040;
        }

        .sh-attr {
            color: ${theme.colorLogoPink};
        }

        .sh-keyword {
            color: #48872b;
        }

        .sh-operator {
            color: #005d83;
        }

        .sh-error {
            padding-left: 0.4em;
            padding-right: 0.4em;
            color: #FFFFFF;
            background-color: ${theme.colorLogoPink};
        }

        .sh-value-warning {
            text-decoration: underline;
        }

        .sh-value-clickable {
            text-decoration: none;
            background-color: #e1e5f6;
        }

        .sh-value-clickable:hover {
            color: ${theme.colorLogoBlue};
            text-decoration: underline;
        }
    }

    > span.simple-input {
        font-size: 1.4em;
        padding: 0.5em 0.3em 0.5em 0.3em;

        a.sh-sugg {
            text-decoration: none;
            background-color: #CCE8F4;
            text-decoration-color: ${theme.colorLogoBlueShining};
            color: ${theme.colorDefaultText};
            background-image: url(${tokenHighlightImg});
            background-repeat: no-repeat;
            background-position: calc(100% - .25em) 0.2em;
            background-size: 0.34em;
            padding-right: 1em;
            padding-left: 0.2em;
        }

        a.sh-sugg:hover {
            color: ${theme.colorLogoBlue};
            text-decoration: underline;
        }

        a.sh-modified {
            text-decoration: none;
            background-color: #F9CFE6;
            color: ${theme.colorDefaultText};
            background-image: url(${configIconPink});
            background-repeat: no-repeat;
            background-position: calc(100% - .2em) 0.2em;
            background-size: 0.6em;
            padding-right: 1em;
            padding-left: 0.2em;
        }
    }

    textarea {
        margin: 0;
        resize: vertical;
        font-family: ${theme.monospaceFontFamily};
    }

    .cql-editor-messages {
        padding: 0.3em;

        .cql-editor-message {
            color: ${theme.colorLogoPink};
            border-radius: ${theme.inputBorderRadius};
        }
    }

    ${theme.mediaPhone} {

        border-radius: ${theme.inputBorderRadius};
        border: ${theme.inputBorderStyle};
        background-color: #FFFFFF;

        > textarea,
        pre.cql-input,
        > input[type=text] {
            min-width: auto;
        }
    }
`;

// ----------- <TRQueryTypeField /> ----------------------------

export const TRQueryTypeField = styled.div`

    display: flex;
    align-items: center;
    margin: 0;
    padding: 0;


    .ToggleSwitch {
        margin-left: 0.3em;
    }

    .hint {
        display: block;
        margin-left: 2em;

        img {
            margin: 0;
            padding: 0;
            display: block;
            width: 0.9em;
        }
    }
`;

// ----------- <TRIncludeEmptySelector /> ----------------------------

export const TRIncludeEmptySelector = styled.div`

    input {
        display: inline-block;
        vertical-align: middle;
        margin-left: 0;
    }
`;

// ----------------- <HistoryWidget /> --------------------------------

export const HistoryWidget = styled.div`

    min-width: 25em;
    max-width: 30em;
    position: absolute;
    border: 1px solid  ${theme.colorLightFrame};
    background-color: #FFFFFF;
    box-shadow: ${theme.portalBoxShadow};
    padding: 0;

`;

// ------------------- <SuggestionsWidget /> --------------------------

export const SuggestionsWidget = styled.div`

    min-width: 25em;
    max-width: 30em;
    max-height: 25em;
    overflow: auto;
    position: absolute;
    border: 1px solid ${theme.colorLightFrame};
    background-color: #FFFFFF;
    box-shadow: ${theme.portalBoxShadow};
    padding: 0.7em 0.3em;


    h2 {
        margin: 0;
        font-size: 1.1em;
        font-weight: normal;
        color: ${theme.colorLogoPink};
    }

    .loader {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1em;
    }
`;