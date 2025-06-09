describe('Chat Page', () => {
  beforeEach(() => {
    cy.visit('/chat');
  });

  it('should load the chat page and display essential elements', () => {
    // ヘッダーやタイトルが表示されているか確認
    cy.contains('h1', 'Chat with your AI').should('be.visible'); // このテキストは実際のUIに合わせてください
    
    // チャット入力欄が表示されているか確認
    cy.get('textarea[placeholder="Type your message..."]').should('be.visible');

    // 送信ボタンが表示されているか確認
    cy.get('button').contains('Send').should('be.visible');
  });

  it('should allow typing in the chat input field', () => {
    // チャット入力欄に文字を入力できることを確認
    cy.get('textarea[placeholder="Type your message..."]')
      .type('Hello, AI assistant!')
      .should('have.value', 'Hello, AI assistant!');
  });

  it('should have a functional send button', () => {
    // 入力欄にメッセージを入力
    cy.get('textarea[placeholder="Type your message..."]')
      .type('Test message');

    // 送信ボタンをクリック
    cy.get('button').contains('Send').click();

    // 入力欄がクリアされることを確認
    cy.get('textarea[placeholder="Type your message..."]')
      .should('have.value', '');
  });
});