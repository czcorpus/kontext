/// <reference types="cypress" />


describe('Paradigmatic query', () => {

    before(() => {
        cy.actionLogin();
    });

    it('defines a query using separate sub-queries and submits', () => {
        cy.hoverNthMenuItem(1);
        cy.clickMenuItem(1, 2);

        cy.get('#pquery-form-mount .cql-input').eq(0).type('[word="do.*"]');
        cy.get('#pquery-form-mount .cql-input').eq(1).type('[tag="N.*"]');
        cy.get('#pquery-form-mount button.add').click();
        cy.get('#pquery-form-mount .cql-input').eq(2).type('[tag="V.*"]');
        cy.get('#pquery-form-mount .submit').click();

        // test result page
        cy.url().should('include', '/pquery/result');
        cy.get('#pquery-result-mount .data tbody tr').should('have.length', 1);

        // breadcrumb navig. test
        cy.get('.corpus-and-query ul li strong').contains('Paradigmatic query');

        // TODO
    });

});