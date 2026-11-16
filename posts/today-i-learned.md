---
title: 오늘 배운 것
date: 2026-11-16
---

Claude Code와 함께 이 블로그를 만들면서 웹 페이지를 이루는 세 가지 기술, **HTML**, **CSS**, **JavaScript**의 역할을 정리해 보았습니다.

## 한 줄 요약

| 기술 | 역할 | 비유 |
| :--- | :--- | :--- |
| HTML | 내용과 구조 | 집의 뼈대 |
| CSS | 모양과 배치 | 인테리어 |
| JavaScript | 동작과 기능 | 전기와 수도 |

## HTML: 내용과 구조

HTML은 페이지에 **무엇이 있는지**를 정합니다. 제목, 문단, 링크, 버튼 같은 요소를 태그로 표시합니다.

이 블로그의 `index.html`은 페이지의 큰 틀만 가지고 있습니다.

```html
<header>블로그 제목 + 테마 버튼</header>
<main id="app">글이 들어갈 자리</main>
<footer>© 2026 My Blog</footer>
```

- `<header>`, `<main>`, `<footer>`처럼 **의미 있는 태그**를 쓰면 화면 읽기 프로그램과 검색 엔진이 페이지를 더 잘 이해합니다.
- `<html lang="ko">`로 페이지 언어를 알려 줍니다.
- `<meta name="viewport">` 한 줄 덕분에 휴대폰에서도 화면이 알맞은 크기로 보입니다.

## CSS: 모양과 배치

CSS는 HTML 요소가 **어떻게 보일지**를 정합니다. 글꼴, 색, 여백, 화면 크기에 따른 배치를 담당합니다.

이번에 배운 핵심은 세 가지입니다.

1. **읽기 좋은 글**: 본문 폭을 `max-width: 680px`로 제한하고, 줄 간격을 `line-height: 1.7`로 넉넉하게 줍니다.
2. **모바일 우선**: 작은 화면용 스타일을 먼저 쓰고, 큰 화면은 `@media (min-width: 768px)`로 덧붙입니다.
3. **다크 모드**: 색을 변수로 모아 두고, 다크 모드일 때 변수 값만 바꿉니다.

```css
:root {
  --bg: #fdfdfc;
  --text: #222222;
}

:root[data-theme="dark"] {
  --bg: #1a1a1a;
  --text: #e6e6e6;
}

body {
  background: var(--bg);
  color: var(--text);
}
```

> 색을 변수로 관리하면 다크 모드를 추가해도 나머지 CSS는 거의 고칠 필요가 없습니다.

## JavaScript: 동작과 기능

JavaScript는 페이지가 **무엇을 할지**를 정합니다. 사용자의 클릭에 반응하고, 파일을 불러오고, 화면 내용을 바꿉니다.

이 블로그에서 JavaScript가 하는 일은 다음과 같습니다.

- `fetch()`로 `posts/index.json`과 마크다운 파일을 불러옵니다.
- 직접 만든 변환기(`markdown.js`)로 **마크다운을 HTML로** 바꿉니다.
- 주소의 `#/post/글이름` 부분을 보고 어떤 화면을 보여 줄지 정합니다.
- 테마 버튼을 누르면 다크 모드를 켜고 끄며, 선택을 `localStorage`에 저장합니다.

```js
button.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
});
```

## 그 밖에 알게 된 것

- **`index.html`을 더블클릭하면 글이 안 보입니다.** 브라우저가 보안 때문에 `file://`에서는 파일 불러오기를 막기 때문입니다. 그래서 `start-blog.bat`으로 작은 로컬 서버를 띄워서 엽니다.
- **보안도 신경 써야 합니다.** 마크다운 안의 HTML 태그는 글자로 바꿔서 보여 주고, `javascript:`로 시작하는 위험한 링크는 막습니다.
- **프레임워크 없이도 충분합니다.** 작은 블로그라면 HTML, CSS, JavaScript만으로 깔끔하게 만들 수 있습니다.

---

정리하면, **HTML이 뼈대를 세우고, CSS가 보기 좋게 꾸미고, JavaScript가 움직이게 만듭니다.** 다음에는 태그별로 글을 모아 보는 기능을 만들어 보고 싶습니다.
