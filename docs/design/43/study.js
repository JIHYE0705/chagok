// Design-only fixtures; no account, API, cookie, or storage writes.
const recipes = [
  { title: '땡초김밥', summary: '잘게 다진 채소와 어묵으로 만드는 매콤한 김밥.', tags: ['도시락', '집밥'], date: '2026-10-18', favorite: true, image: 'https://static.wtable.co.kr/image/production/service/recipe/1430/0f4ee459-9c66-4d5a-9770-69c5af9f4d4c.jpg?size=800x800' },
  { title: '고구마 누룽지', summary: '얇게 펴서 바삭하게 굽는 간식. 원문에 없는 분량과 조리 조건은 비워 두었어요.', tags: ['간식', '다시 만들기'], date: '2026-10-17', favorite: false },
  { title: '냉장고 속 남은 재료로 만드는 주말 한 끼 — 바쁜 날에도 꺼내 보기 좋은 초간단 레시피와 재료 보관 팁까지 차곡차곡 모아 두기', summary: '긴 제목의 표시 예시예요. 제목을 누르면 원문 전체를 읽을 수 있어요.', tags: ['집밥'], date: '2026-10-16', favorite: true },
  { title: '감자 수프', summary: '감자 200 g · 소금 약간. 분량과 단위가 섞인 글을 읽어보세요.', tags: ['집밥'], date: '2026-10-15', favorite: false },
];
const results = document.querySelector('#results');
const form = document.querySelector('#search-form');
const detail = document.querySelector('#detail');
const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20S3 14.5 3 8.5a4.5 4.5 0 0 1 9-1 4.5 4.5 0 0 1 9 1C21 14.5 12 20 12 20Z"/></svg>';
function render() {
  const query = document.querySelector('#query').value.trim().toLocaleLowerCase('ko');
  const tag = document.querySelector('#tag').value;
  const favorites = document.querySelector('#favorites').checked;
  const visible = recipes.filter(recipe => (!tag || recipe.tags.includes(tag)) && (!favorites || recipe.favorite) && [recipe.title, recipe.summary, ...recipe.tags].join(' ').toLocaleLowerCase('ko').includes(query));
  results.replaceChildren();
  for (const recipe of visible) {
    const card = document.createElement('article');
    card.className = `recipe${recipe.image ? '' : ' text-only'}`;
    card.innerHTML = '<div class="recipe-content"><div class="title-row"><h2><button class="title-button" type="button"></button></h2><button class="favorite" type="button"></button></div><p class="recipe-summary"></p><div class="tags"></div><p class="meta"><span>레시피</span><time></time></p></div>';
    if (recipe.image) {
      const cover = document.createElement('div');
      cover.className = 'photo';
      cover.innerHTML = '<img width="800" height="800" alt="우리의식탁 땡초김밥"><span class="credit">사진 · 우리의식탁</span>';
      const image = cover.querySelector('img');
      image.addEventListener('error', () => { cover.replaceChildren(); const fallback = document.createElement('span'); fallback.className = 'photo-fallback'; fallback.textContent = '사진을 불러오지 못했어요'; cover.append(fallback); }, { once: true });
      image.src = recipe.image;
      card.prepend(cover);
    }
    const title = card.querySelector('.title-button');
    title.textContent = recipe.title;
    title.addEventListener('click', () => {
      document.querySelector('#detail-title').textContent = recipe.title;
      document.querySelector('#detail-summary').textContent = recipe.summary;
      detail.setAttribute('aria-labelledby', 'detail-title');
      detail.showModal();
    });
    card.querySelector('.recipe-summary').textContent = recipe.summary;
    card.querySelector('time').dateTime = recipe.date;
    card.querySelector('time').textContent = recipe.date.replaceAll('-', '.');
    for (const name of recipe.tags) { const chip = document.createElement('span'); chip.className = 'tag'; chip.textContent = name; card.querySelector('.tags').append(chip); }
    const favorite = card.querySelector('.favorite');
    favorite.innerHTML = heart;
    favorite.setAttribute('aria-label', `${recipe.title} 즐겨찾기`);
    favorite.setAttribute('aria-pressed', String(recipe.favorite));
    favorite.addEventListener('click', () => {
      recipe.favorite = !recipe.favorite;
      if (document.querySelector('#favorites').checked) { render(); document.querySelector('#favorites').focus(); }
      else favorite.setAttribute('aria-pressed', String(recipe.favorite));
    });
    results.append(card);
  }
  document.querySelector('#empty').hidden = visible.length > 0;
  document.querySelector('#count').textContent = `${visible.length}개`;
  document.querySelector('#result-status').textContent = `검색 결과 ${visible.length}개`;
}
form.addEventListener('submit', event => { event.preventDefault(); render(); });
document.querySelector('#tag').addEventListener('change', render);
document.querySelector('#favorites').addEventListener('change', render);
document.querySelector('#reset').addEventListener('click', () => { form.reset(); render(); document.querySelector('#query').focus(); });
document.querySelectorAll('button[data-view]').forEach(button => button.addEventListener('click', () => {
  document.body.dataset.view = button.dataset.view;
  document.querySelectorAll('button[data-view]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
}));
document.querySelector('#font').addEventListener('change', event => {
  const nanum = event.target.value === 'nanum';
  document.body.style.setProperty('--font', nanum ? 'Nanum' : 'Pretendard');
  document.body.style.setProperty('--strong', nanum ? '700' : '600');
});
document.querySelectorAll('[data-demo]').forEach(button => button.addEventListener('click', () => { document.querySelector('#demo-status').textContent = button.dataset.demo; }));
document.querySelector('#close-detail').addEventListener('click', () => detail.close());
render();
