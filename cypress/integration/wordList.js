/// <reference types="cypress" />


describe('Word List', () => {

    before(() => {
        cy.actionLogin();
    });

    it('defines a simple word list query and submits', () => {
        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 3);

        cy.get('#wl-attr-selector').select('word');
        cy.get('#wl-pattern-input').type('.*ining');
        cy.get('#wl-min-freq-input').clear().type('10');
        cy.get('#wordlist-form-mount .default-button').click();

        // test result page
        cy.url().should('include', '/wordlist/result');
        cy.get('#wordlist-result-mount .data tbody tr').should('have.length', 2);

        // breadcrumb navig. test
        cy.get('.corpus-and-query ul li strong').contains('Word list');
    });

});