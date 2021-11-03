/// <reference types="cypress" />


describe('Initial testing experiments', () => {
    it('Logs in, creates a concordance and calculates freq. distrib. by lemmas', () => {
        cy.actionLogin();
        cy.get('.query .options label[for="match-case-switch-susanne"]').click();
        cy.get('.simple-input').type('London');
        cy.get('.query .default-button').click();

        cy.hoverNthMenuItem(6);
        cy.clickMenuItem(6, 1);

        const dataTable = cy.get('.freq-blocks .data');
        dataTable.should('be.visible');
        dataTable.get('tbody tr').should('have.length', 1);
    })
  })