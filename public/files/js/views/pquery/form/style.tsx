/*
 * Copyright (c) 2021 Charles University, Faculty of Arts,
 *                    Institute of the Czech National Corpus
 * Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

// ---------------- <PqueryForm /> -------------

export const PqueryForm = styled.div`
    form >* {
        margin-top: 1em;
    }

    .loader {
        margin-left: 1em;
    }
`;

export const QueryField = styled.div`
    width: 100%;
    display: flex;
    align-items: center;

    textarea {
        flex-grow: 1;
    }
`;

export const ParametersFieldset = styled.fieldset`
    display: flex;
    align-items: center;

    & >* {
        flex-grow: 1;
    }
`;

export const ParameterField = styled.span`
    label {
        margin: 0 0.5em;
    }
`;
