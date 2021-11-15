/// <reference types="cypress" />


describe('Word List', () => {

    beforeEach(() => {
        cy.actionLogin();
        
        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 3);
    });

    afterEach(() => {
        cy.actionLogout();
    });

    it('defines a simple word list query, submits and reloads query form from history', () => {
        cy.get('#wl-attr-selector').select('word');
        cy.get('#wl-pattern-input').type('.*ining');
        cy.get('#wordlist-form-mount .default-button').click();

        // test result page
        cy.url().should('include', '/wordlist/result');
        cy.get('#wordlist-result-mount .data tbody tr').should('have.length', 5);
        cy.get('#wordlist-result-mount .data').contains('containing');
        cy.get('#wordlist-result-mount .data').contains('training');
        cy.get('#wordlist-result-mount .data').contains('remaining');
        cy.get('#wordlist-result-mount .data').contains('obtaining');
        cy.get('#wordlist-result-mount .data').contains('mining');

        // breadcrumb navig. test
        cy.get('.corpus-and-query ul li strong').contains('Word list');

        // test last query
        cy.openLastHistoryItem();
        cy.url().should('include', '/wordlist/form');
        cy.get('#wl-attr-selector').should('have.value', 'word');
        cy.get('#wl-pattern-input').should('have.value', '.*ining');
    });

    it('defines a word list query with min freq, submits and reloads query form from history', () => {
        cy.get('#wl-attr-selector').select('word');
        cy.get('#wl-pattern-input').type('.*ining');
        cy.get('#wl-min-freq-input').clear().type('10');
        cy.get('#wordlist-form-mount .default-button').click();

        // test result page
        cy.url().should('include', '/wordlist/result');
        cy.get('#wordlist-result-mount .data tbody tr').should('have.length', 2);
        cy.get('#wordlist-result-mount .data').contains('containing');
        cy.get('#wordlist-result-mount .data').contains('training');

        // breadcrumb navig. test
        cy.get('.corpus-and-query ul li strong').contains('Word list');

        // test last query
        cy.openLastHistoryItem();
        cy.url().should('include', '/wordlist/form');
        cy.get('#wl-attr-selector').should('have.value', 'word');
        cy.get('#wl-pattern-input').should('have.value', '.*ining');
        cy.get('#wl-min-freq-input').should('have.value', '10');
    });

    it('defines a word list query with lemma search attr, submits and reloads query form from history', () => {
        cy.get('#wl-attr-selector').select('lemma');
        cy.get('#wl-pattern-input').type('.*ining');
        cy.get('#wordlist-form-mount .default-button').click();

        // test result page
        cy.url().should('include', '/wordlist/result');
        cy.get('#wordlist-result-mount .data tbody tr').should('have.length', 1);
        cy.get('#wordlist-result-mount .data').contains('training');

        // breadcrumb navig. test
        cy.get('.corpus-and-query ul li strong').contains('Word list');

        // test last query
        cy.openLastHistoryItem();
        cy.url().should('include', '/wordlist/form');
        cy.get('#wl-attr-selector').should('have.value', 'lemma');
        cy.get('#wl-pattern-input').should('have.value', '.*ining');
    });

    it('defines a word list query including non-words, submits and reloads query form from history', () => {
        cy.get('#wl-pattern-input').type(',');
        cy.get('#wordlist-form-mount label[for="wl-include-non-words-checkbox"]').click();
        cy.get('#wordlist-form-mount .default-button').click();

        // test result page
        cy.url().should('include', '/wordlist/result');
        cy.get('#wordlist-result-mount .data tbody tr').should('have.length', 1);

        // breadcrumb navig. test
        cy.get('.corpus-and-query ul li strong').contains('Word list');

        // test last query
        cy.openLastHistoryItem();
        cy.url().should('include', '/wordlist/form');
        cy.get('#wl-pattern-input').should('have.value', ',');
        cy.get('#wl-include-non-words-checkbox').should('be.checked');
    });

    it('defines a word list query with positive filter, submits and reloads query form from history', () => {
        cy.get('#wl-attr-selector').select('word');
        cy.get('#wl-pattern-input').type('.*ining');
        cy.get('#wlform-filter-options button[type="button"]').click();
        cy.get('#filter-file-pfilter-create').click();
        cy.get('#wordlist-form-mount .closeable-frame .contents textarea').type('containing');
        cy.get('#wordlist-form-mount .closeable-frame .contents button').click();
        cy.get('#wordlist-form-mount .default-button').click();

        // test result page
        cy.url().should('include', '/wordlist/result');
        cy.get('#wordlist-result-mount .data tbody tr').should('have.length', 1);
        cy.get('#wordlist-result-mount .data').contains('containing');

        // breadcrumb navig. test
        cy.get('.corpus-and-query ul li strong').contains('Word list');

        // test last query
        cy.openLastHistoryItem();
        cy.url().should('include', '/wordlist/form');
        cy.get('#wl-attr-selector').should('have.value', 'word');
        cy.get('#wl-pattern-input').should('have.value', '.*ining');
    });

    it('defines a word list query with negative filter, submits and reloads query form from history', () => {
        cy.get('#wl-attr-selector').select('word');
        cy.get('#wl-pattern-input').type('.*ining');
        cy.get('#wlform-filter-options button[type="button"]').click();
        cy.get('#filter-file-nfilter-create').click();
        cy.get('#wordlist-form-mount .closeable-frame .contents textarea').type('containing');
        cy.get('#wordlist-form-mount .closeable-frame .contents button').click();
        cy.get('#wordlist-form-mount .default-button').click();

        // test result page
        cy.url().should('include', '/wordlist/result');
        cy.get('#wordlist-result-mount .data tbody tr').should('have.length', 4);
        cy.get('#wordlist-result-mount .data').contains('training');
        cy.get('#wordlist-result-mount .data').contains('remaining');
        cy.get('#wordlist-result-mount .data').contains('obtaining');
        cy.get('#wordlist-result-mount .data').contains('mining');

        // breadcrumb navig. test
        cy.get('.corpus-and-query ul li strong').contains('Word list');

        // test last query
        cy.openLastHistoryItem();
        cy.url().should('include', '/wordlist/form');
        cy.get('#wl-attr-selector').should('have.value', 'word');
        cy.get('#wl-pattern-input').should('have.value', '.*ining');
    });

    it('defines a word list query using output options, submits and reloads query form from history', () => {
        cy.get('#wl-attr-selector').select('lemma');
        cy.get('#wl-pattern-input').type('have');
        cy.get('#wlform-output-options button[type="button"]').click();
        cy.get('#wordlist-form-mount .output-types ul.wl-option-list li:nth-child(2) input[type="radio"]').click();
        cy.get('#wordlist-form-mount .output-types ul.wl-option-list select').select('word');
        cy.get('#wordlist-form-mount .default-button').click();

        // TODO Freqs page?

        cy.url().should('include', '/freqs');
        const dataTable = cy.get('.freq-blocks .data');
        dataTable.should('be.visible');
        dataTable.get('tbody tr').should('have.length', 7);

        // test last query
        cy.openLastHistoryItem();
        cy.url().should('include', '/wordlist/form');
        cy.get('#wl-attr-selector').should('have.value', 'lemma');
        cy.get('#wl-pattern-input').should('have.value', 'have');
        cy.get('#wlform-output-options button[type="button"]').click();
        cy.get('#wordlist-form-mount .output-types ul.wl-option-list li:nth-child(2) input[type="radio"]').should('be.checked');
        cy.get('#wordlist-form-mount .output-types ul.wl-option-list select').should('have.value', 'word');
    });
});