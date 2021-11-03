/// <reference types="cypress" />

describe('Initial testing experiments', () => {
    it('Logs in, creates a concordance and calculates freq. distrib. by lemmas', () => {
        cy.viewport(1600, 1200);
        cy.visit('http://localhost:8080/query?corpname=susanne');
        cy.get('.user .sign-in').click();
        cy.get('.closeable-frame input[type="text"]').type('cypress');
        cy.get('.closeable-frame input[type="password"]').type('mypassword');
        cy.get('.closeable-frame button[type="submit"]').click();
        cy.get('.query .options label[for="match-case-switch-susanne"]').click();
        cy.get('.simple-input').type('London');
        cy.get('.query .default-button').click();

        cy.get('#main-menu-mount li:nth-child(6) a').realHover();
        cy.get('#main-menu-mount li:nth-child(6) .submenu li:nth-child(1)').should('be.visible').click();

        const dataTable = cy.get('.freq-blocks .data');
        dataTable.should('be.visible');
        dataTable.get('tbody tr').should('have.length', 1);
    })
  })