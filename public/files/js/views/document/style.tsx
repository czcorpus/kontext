/*
 * Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

const closeIconImg = require('../../../img/close-icon.svg').default;
const closeIconSImg = require('../../../img/close-icon_s.svg').default;
const movableImg = require('../../../img/movable.svg').default;
const externalLinkImg = require('../../../img/external-link.png').default;
const warningIconImg = require('../../../img/warning-icon.svg').default;

// ---------------- <ModalOverlay /> --------------------------------------

export const ModalOverlay = styled.div`
    position: fixed;
    z-index: 5000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: RGBA(20, 20, 20, 0.70);
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

    ${ModalOverlay} > & {
        position: absolute;
        top: 30%;
        left: 50%;
        transform: translate(-50%,-30%);
    }

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

    @media screen and (max-width: 1366px) {
        max-width: 90%;
    }

    ${theme.mediaPhone} {
        max-width: 100%;
    }

    .PersistentConcordanceForm {

        input {
            font-size: 1.5em;
            width: 30em;
            display: inline-block;
            margin-top: 0.4em;
            margin-bottom: 1em;
            color: ${theme.colorSuperlightText};
        }

        input.archived {
            color: ${theme.colorDefaultText};
        }

    }

    .QuerySaveAsForm,
    .PersistentConcordanceForm {

        p.hint {
            width: 30em;
            white-space: initial;
            color: ${theme.colorDefaultText};

            .icon {
                display: inline-block;
                vertical-align: middle;
                margin-right: 0.4em;

                img {
                    width: 1.2em;
                }
            }
        }
    }
`;

// ---------------- <TooltipBox /> --------------------------------------

export const TooltipBox = styled.section`
    z-index: 1000;
    position: absolute;
    border: 1px solid #e2eaea;
    background-color: ${theme.colorWhitelikeBlue};
    border-radius: 5px;
    box-shadow: 5px 5px 7px #aaa;
    padding: 1.4em;
    color: #444444;
    text-align: left;
    white-space: normal;

    .header {
        padding-bottom: 0.4em;
    }

    h3 {
        margin-top: 0;
    }

    img.info-icon {
        margin-right: 0.7em;
        padding-bottom: 0.2em;
        display: inline-block;
        width: 1.4em;
        vertical-align: middle;
    }

    > div > p {
        margin: 0.4em 0;
        padding-left: 0.4em;
        padding-right: 0.4em;
    }

    button.close-link {
        display: block;
        position: absolute;
        padding: 0.1em;
        margin: 0;
        width: ${theme.closeButtonSize};
        height: ${theme.closeButtonSize};
        top: 0.4em;
        right: 0.4em;
        background-image: url(${closeIconImg});
        background-size: ${theme.closeButtonSize} ${theme.closeButtonSize};
        background-repeat: no-repeat;
        background-position: 0.1em 0.1em;
        cursor: pointer;
        border: none;
        background-color: transparent;
        box-sizing: content-box;
    }

    button.close-link:focus {
        outline: none;
    }

    button.close-link:hover {
        background-image: url(${closeIconSImg});
    }

    div.movable {
        position: absolute;
        left: 0.4em;
        top: 0.4em;
        padding: 0.1em;
        width: 1em;
        height: 1em;
        background-image: url(${movableImg});
        background-size: 100% 100%;
        background-repeat: no-repeat;
        cursor: move;
    }

    code {
        color: ${theme.colorLogoPink};
    }

    &.hint {
        max-width: 35em;
    }

    &.metadata-detail {
        ul {
            margin: 0;
            padding: 0;
            list-style-type: none;

            li {
                padding: 0.1em 0;
                margin: 0;
            }
        }
        .message {
            margin: 0.6em;
            background-image: url(${warningIconImg});
            background-repeat: no-repeat;
            background-size: 1em;
            background-position: 0 0.2em;

            p:first-letter {
                padding-left: 1.6em;
            }
        }
    }

    &.hidden {
        display: none;
    }

    &.centered {
        left: 19%;
        right: 19%;
    }

    ${ModalOverlay} > & {
        position: absolute;
        top: 30%;
        left: 50%;
        transform: translate(-50%,-30%);
        min-width: 70%;
        box-shadow: 3px 3px 4px #444;
        background-color: ${theme.colorSectionBg};
    }

    ${ModalOverlay} > &.async-task-list {
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

                a {
                    color: ${theme.colorLogoBlue};
                }
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
`;

// ---------------- <InlineHelp /> --------------------------------------

export const InlineHelp = styled.span`

    > span { // => noSuperscript === true

        display: inline-block;
        height: 100%;

        img {
            width: 1em;
            margin-top: 0.2em;
            display: block;
        }

        a {
            display: flex;
            align-items: center;
        }
    }

    ${TooltipBox} {
        font-weight: normal;
        padding-bottom: 0.7em;

        div.link {
            margin: 0;
            text-align: right;

            a {
                background-image: url(${externalLinkImg});
                background-repeat: no-repeat;
                background-position: 100% 0;
                padding-right: 14px;
                color: ${theme.colorLogoBlue};
                text-decoration: none;
            }

            a:hover {
                text-decoration: underline;
            }
        }
    }
`;

// ---------------- <Abbrevation /> --------------------------------------

export const Abbrevation = styled.span`

    display: inline-block;
    text-decoration: none;
    cursor: help;
    border-color: ${theme.colorDefaultText};
    border-style: dotted;
    border-width: 0 0 1px 0;
`;

// ---------------- <ErrorBoundary /> --------------------------------------

export const ErrorBoundary = styled.span`

    padding: 1em;
    border-width: 1pt;
    border-radius: ${theme.borderRadiusDefault};
    border-color: #adadad;
    border-style: solid;
    background-color: #ededed;

    .message {
        text-align: center;

        img {
            display: inline-block;
            vertical-align: middle;
            margin-right: 0.7em;
        }
    }

    .symbol {
        text-align: center;
    }

    .note {
        text-align: center;
    }
`;

// ---------------- <ValidatedItem /> --------------------------------------

export const ValidatedItem = styled.span`

    .error-desc {
        font-size: 80%;
        background-color: ${theme.colorDefaultText};
        color: #ffb4b4;
        padding: 0.2em 2em;
        border-radius: ${theme.inputBorderRadius};
    }

    &.invalid input,
    &.invalid textarea {
        background-color: #ffb4b4;
    }
`;

// ---------------- <TabButton /> --------------------------------------

export const TabButton = styled.span`

    &:not(:first-child) {
        margin-left: 0.7em;
    }

    display: inline-block;
    text-align: center;

    button {
        display: inline;
    }

    .underline {
        margin-top: 0.6em;
        margin-left: 0.1em;
        margin-right: 0.1em;
        display: block;
        height: 0.15em;
        border-radius: ${theme.inputBorderRadius};
        background-color: ${theme.colorLogoBlue};
    }

    .underline.hidden {
        visibility: hidden;
    }
`;

// ---------------- <PlusButton /> --------------------------------------

export const PlusButton = styled.button`

    display: inline-block;

    img {
        display: block;
        height: 1em;
        width: 1em;
        padding: 0.2em;
    }
`;

// ---------------- <KwicRangeSelector /> --------------------------------------

export const KwicRangeSelector = styled.div`

    padding: 0.4em 0;

    .items {
        display: flex;
        align-items: center;

        .pos {
            display: block;
            border: 1px solid ${theme.colorDarkGreenText};
            color: ${theme.colorDefaultText};

            a, span {
                display: block;
                padding: 0.3em;
                text-decoration: none;
                color: ${theme.colorDefaultText};
            }

            a:hover {
                color: ${theme.colorLogoBlue};
            }
        }

        .pos:not(.kwic) {
            width: 1.5em;
        }

        .pos.kwic {
            a, span {
                color: ${theme.colorLogoPink};
            }
        }

        .pos.left-lim {
            border-radius: 0.3em 0 0 0.3em;
        }

        .pos:not(.left-lim) {
            border-left: none;
        }

        .pos.right-lim {
            border-radius: 0 0.3em 0.3em 0;
        }

        .pos.selected a {
            background-color: ${theme.colorLogoBlue};
            color: ${theme.colorWhiteText};
            font-weight: bold;
        }

        div {

            input.manual-range {
                border-radius: ${theme.inputBorderRadius};
                width: 2em;
                padding-top: 0.2em;
                padding-bottom: 0.2em;
            }

            input.manual-range.invalid {
                border: 1px solid red;
            }

            input.manual-range.invalid:focus {
                outline: none;
                border: 1px solid red;
            }
        }

        div.selected {
            input:not(.invalid) {
                background-color: ${theme.colorLogoBlue};
                color: ${theme.colorWhiteText};
            }
        }
    }
`;

// ---------------- <UnsupportedRenderer /> --------------------------------------

export const UnsupportedRenderer = styled.div`

    .note {
        text-align: center;
    }

    .data-label {
        margin-bottom: 0;
    }

    pre {
        font-size: 0.7em;
        white-space: normal;
    }
`;

// ---------------------- <Calendar /> -------------------------------------------

export const Calendar = styled.div`

    table {
        border-collapse: collapse;
        border-spacing: 0;
    }

    table th,
    table td {
        border: 1px solid ${theme.colorLightGrey};
        padding: 0.2em;
    }

    table th {
        text-align: center;
    }

    table td {
        text-align: right;
    }

    table tbody td a {
        text-decoration: none;
        display: block;
    }

    table tbody td a:hover {
        text-decoration: underline;
    }

    table td.current {
        background-color: #efefef;
    }

    table td.current a {
        color: #222222;
    }

    table td.current.active {
        background-color: ${theme.colorLogoPink};
    }

    table td.current.active a {
        color: #dedede;
    }

    .controls td {
        padding: 0;
    }

    .controls td a.prev-month-change,
    .controls td a.next-month-change {
        border-right-width: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
    }

    .controls td a.prev-month-change img,
    .controls td a.next-month-change img {
        display: block;
        width: 60%;
        padding: 0.2em;
    }

    .controls .curr-date {
        padding: 0.1em;
        text-align: center;
    }
`;

// ------------------- <CorpnameInfoTriggerLI /> --------------------

export const CorpnameInfoTriggerLI = styled.li`

    a {
        color: ${theme.colorLogoBlue};
        text-decoration: none;
    }

    a:hover {
        text-decoration: underline;
    }

    .subcorpus {
        color: ${theme.colorLogoBlue};
    }

    .subcorpus.foreign {
        color: ${theme.colorLogoPink};
    }
`;


// --------------- <DelItemIconA /> -----------------------

export const DelItemIconA = styled.a`

    display: inline-block;
    text-decoration: none;
    padding: 0 0.1em;

    &.disabled,
    &.disabled:hover {
        cursor: default !important;
        color: ${theme.colorSuperlightText} !important;
        background-color: transparent !important;
    }

    &:hover {
        text-decoration: none !important;
        color: #FFFFFF !important;
    }
`;

// ------------------ <ExpandButton /> ---------------------

export const ExpandButton = styled.button`

    margin: 0.2em;
    display: inline-block;
    background-color: ${theme.colorButtonDefault};
    color: ${theme.colorLogoBlue};
    border-color: ${theme.colorLogoBlue};
    border-width: 0.1em;
    border-style: solid;
    border-radius: ${theme.inputBorderRadius};
    cursor: pointer;

    span {
        font-size: 1.5em;
        font-weight: bold;
        display: block;
        margin: 0 auto;
        width: 0.7em;
        line-height: 0.7em;
        height: 0.8em;
    }

    &:hover {
        background-color: ${theme.colorButtonHover};
    }

    &.readonly {
        cursor: inherit;

        border-color: ${theme.colorLightGrey};
        color: ${theme.colorLightGrey};
    }
`;

// ------------------- <ExpandableAreaDiv /> --------------------

export const ExpandableAreaDiv = styled.div`

    .controls .ExpandButton {
        margin-right: 0.7em;
    }

    .controls > a {
        color: ${theme.colorLogoBlue};
        text-decoration: none;
    }

    .controls > a:hover {
        text-decoration: underline;
    }

    &.readonly .controls span {
        color: ${theme.colorLightText};
    }
`;

// ------------------ <MessagesDiv /> ----------------------------------------

export const MessagesDiv = styled.div`

    display: block;
    position: fixed;
    left: 50%;
    top: 7em;
    z-index: 10000;

    .message {
        background-color: #FEFEFE;
        border: solid 1px #eeeeee;
        border-radius: ${theme.borderRadiusDefault};
        box-shadow: 2px 2px 3px #aaa;
        color: ${theme.colorDefaultText};
        font-weight: 700;
        margin: 5pt;
        padding: 0.4em 0.4em 0.4em 1em;
        position: relative;
        left: -50%;
    }

    .message.info {
        color: ${theme.colorDefaultText};
    }

    .icon-box {
        position: absolute;
        padding: 0;
        top: 50%;
        margin-top: -0.8em;
    }

    .icon-box .icon {
        display: block;
        width: 1.6em;
        height: 1.6em;
        margin: 0;
        padding: 0;
    }

    .message-text {
        margin-top: 1em;
        margin-bottom: 1em;
        margin-left: 3em;
        margin-right: 3em;
    }

    .button-box {
        position: absolute;
        top: 50%;
        right: 1em;
        margin-top: -0.5em;
    }

    .button-box .close-icon {
        display: block;
    }

    .button-box .close-icon img {
        width: ${theme.closeButtonSize};
        height: ${theme.closeButtonSize};
    }
`;