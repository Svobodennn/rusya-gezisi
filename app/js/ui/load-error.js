// What the page says when the trip data never arrived (first visit without a connection).

export function showLoadError(hero, main) {
  hero.hidden = true;
  main.setAttribute('aria-busy', 'false');
  main.innerHTML = `<div class="load-error" role="alert">
      <h1 class="section-title">Plan açılamadı</h1>
      <p>Gezi verisi bu cihazda henüz yok. Sayfayı bir kez internete bağlıyken açın; sonra internetsiz de çalışır.</p>
      <p><button type="button" class="act act--accent" id="retry">Tekrar dene</button></p>
    </div>`;
  document.getElementById('retry').addEventListener('click', () => location.reload());
}
