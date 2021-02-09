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

// ---------------- <AlignedLangWidget /> -----------------------------

export const AlignedLangWidget = styled.div`

    text-align: center;
    margin-top: 1em;
`;

// ---------------- <AlignedCorpora /> -----------------------------

export const AlignedCorpora = styled.section`
    &.closed {

        padding-bottom: 0;

        .contents {
            margin: 0;
            padding: 0;
        }
    }
`;

// ---------------- <AlignedCorpBlock /> -----------------------------

export const AlignedCorpBlock = styled.div`

    margin-left: 2.5em;

    table.form {
        margin: 5px 10px;
    }

    .form {
        > *:not(:first-child) {
            margin-top: 1em;
        }

        .query {
            max-width: 60em;
            margin-top: 2.7em;
        }
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
`;