/// <reference types="cypress" />


describe('Concordance - general view options', () => {

    beforeEach(() => {
        cy.viewport(1600, 1200);
        cy.visit('http://localhost:8080/query?corpname=susanne');
    });

    it('tests page size option', () => {
        cy.get('.simple-input').type('and');
        cy.get('.query .default-button').click();

        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 3);

        // check default page size
        cy.get('#conc-dashboard-mount table tbody tr').should('have.length', 40);

        // set page size to 10
        cy.get('#view-options-mount .FieldsetConcordance #conc-page-size').clear().type(10);
        cy.get('#view-options-mount div.buttons button').click();

        // check new page size
        cy.get('#conc-dashboard-mount table tbody tr').should('have.length', 10);
    });

    it('tests page size option', () => {
        cy.get('.simple-input').type('and');
        cy.get('.query .default-button').click();

        cy.hoverNthMenuItem(8);
        cy.clickMenuItem(8, 3);

        // check default kwic size
        cy.get('#conc-dashboard-mount table tbody tr').first().find('td.lc').children().should('have.length', 10);
        cy.get('#conc-dashboard-mount table tbody tr').first().find('td.rc').children().should('have.length', 10);

        // set kwic size to 5
        cy.get('#view-options-mount .FieldsetConcordance #conc-kwic-size').clear().type(5);
        cy.get('#view-options-mount div.buttons button').click();

        // check new kwic size
        cy.get('#conc-dashboard-mount table tbody tr').first().find('td.lc').children().should('have.length', 5);
        cy.get('#conc-dashboard-mount table tbody tr').first().find('td.rc').children().should('have.length', 5);
    });

});