let dictionary = {};

const DATA_URL = './data.json';

const layoutMap = {
    'f':'а', ',':'б', 'd':'в', 'u':'г', 'l':'д', 't':'е', '`':'ё',
    ';':'ж', 'p':'з', 'b':'и', 'q':'й', 'r':'к', 'k':'л', 'v':'м',
    'y':'н', 'j':'о', 'g':'п', 'h':'р', 'c':'с', 'n':'т', 'e':'у',
    'a':'ф', '[':'х', 'w':'ц', 'x':'ч', 'i':'ш', 'o':'щ', ']':'ъ',
    's':'ы', 'm':'ь', '\'':'э', '.':'ю', 'z':'я',
    '<':'Б', '>':'Ю', ':':'Ж', '"':'Э', '{':'Х', '}':'Ъ'
};

const DAY_ORDER = [
    'ПОНЕДЕЛЬНИК',
    'ВТОРНИК',
    'СРЕДА',
    'ЧЕТВЕРГ',
    'ПЯТНИЦА',
    'СУББОТА',
    'ВОСКРЕСЕНЬЕ'
];

function getViewed() {
    const v = localStorage.getItem('viewed');
    return v ? v.split(',') : [];
}

const searchElement = document.querySelector('.search');
const buttonWrapperElement = searchElement.querySelector('.search__button-wrapper');
const inputWrapperElement = searchElement.querySelector('.search__input-wrapper');
const inputElement = inputWrapperElement.querySelector('.search__input');
const hintsElement = searchElement.querySelector('.search__hints');
const hintsHTMLCollection = hintsElement.getElementsByClassName('hint');
const descriptionsElement = document.querySelector('.descriptions');

let isHintDirectlySelected = false;
let selectedHintElement = null;
let viewed = getViewed();
let lastInputValue = '';
let isInputEmpty = true;

function normalizeString(str = '') {
    return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeSearchRequest(str = '') {
    let request = normalizeString(str);
    request = [...request].map((char) => layoutMap[char] ?? char).join('');
    return request;
}

function addTextPart(element, part, classes = []) {
    const partElement = document.createElement('span');
    partElement.classList.add(...classes);
    partElement.innerHTML = part;
    element.append(partElement);
}

function deleteWordFromWatched(word) {
    const index = viewed.indexOf(word);
    if (index > -1) {
        viewed.splice(index, 1);
        localStorage.setItem('viewed', viewed.join());
        inputElement.focus();
    }
}

function createTeacherIfMissing(teacherName) {
    if (!teacherName || !teacherName.trim()) return false;

    if (!dictionary[teacherName]) {
        dictionary[teacherName] = {
            teacher: teacherName,
            lessons: []
        };
    }

    return true;
}

function addLessonToTeacher(teacherName, lessonData) {
    if (!createTeacherIfMissing(teacherName)) return;
    dictionary[teacherName].lessons.push(lessonData);
}

function sortTeacherLessons() {
    for (const teacherName of Object.keys(dictionary)) {
        dictionary[teacherName].lessons.sort((a, b) => {
            const dayDiff = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
            if (dayDiff !== 0) return dayDiff;

            if (a.start_time_seconds !== b.start_time_seconds) {
                return a.start_time_seconds - b.start_time_seconds;
            }

            if ((a.week || '') !== (b.week || '')) {
                return Number(a.week || 0) - Number(b.week || 0);
            }

            return (a.group || '').localeCompare((b.group || ''), 'ru');
        });
    }
}

function buildDictionaryFromSchedule(scheduleData) {
    dictionary = {};

    for (const [groupId, groupData] of Object.entries(scheduleData || {})) {
        const days = groupData?.days || {};

        for (const dayData of Object.values(days)) {
            const dayName = dayData?.name || '';
            const lessons = dayData?.lessons || [];

            lessons.forEach((lesson) => {
                const lessonData = {
                    group: groupId,
                    day: dayName,
                    week: lesson.week || '',
                    name: lesson.name || '',
                    subjectType: lesson.subjectType || '',
                    start_time: lesson.start_time || '',
                    end_time: lesson.end_time || '',
                    start_time_seconds: lesson.start_time_seconds || 0,
                    end_time_seconds: lesson.end_time_seconds || 0,
                    room: lesson.room || '',
                    comment: lesson.comment || '',
                    form: lesson.form || '',
                    url: lesson.url || null
                };

                addLessonToTeacher(lesson.teacher, lessonData);
                addLessonToTeacher(lesson.second_teacher, lessonData);
            });
        }
    }

    sortTeacherLessons();
}

async function loadDictionary() {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const rawData = await response.json();
    buildDictionaryFromSchedule(rawData);
}

function lessonToViewData(lesson) {
    const weekLabel = lesson.week === '1'
        ? '1 неделя'
        : lesson.week === '2'
            ? '2 неделя'
            : 'обе недели';

    const topLine = `· ${weekLabel} · ${lesson.name}`;

    const bottomParts = [];
    if (lesson.subjectType) bottomParts.push(lesson.subjectType.toLowerCase());
    if (lesson.group) bottomParts.push(`гр. ${lesson.group}`);
    if (lesson.room) bottomParts.push(`ауд. ${lesson.room}`);
    if (lesson.form && lesson.form !== 'standard') bottomParts.push(lesson.form);
    if (lesson.comment) bottomParts.push(lesson.comment);

    return {
        time: `${lesson.start_time}–${lesson.end_time}`,
        topLine,
        bottomLine: bottomParts.length ? `· ${bottomParts.join(' · ')}` : ''
    };
}

function addDesc(teacherName, teacherData) {
    descriptionsElement.innerHTML = '';

    const teacherCard = document.createElement('div');
    teacherCard.classList.add('description', 'teacher-card');

    const titleElement = document.createElement('div');
    titleElement.classList.add('description__line');

    addTextPart(titleElement, teacherName, [
        'description__line-part',
        'description__line-part_highlighted'
    ]);

    teacherCard.appendChild(titleElement);

    descriptionsElement.appendChild(teacherCard);

    if (!teacherData || !teacherData.lessons.length) {
        const empty = document.createElement('div');
        empty.classList.add('description');
        addTextPart(empty, 'Расписание не найдено', ['description__line-part']);
        descriptionsElement.appendChild(empty);
        return;
    }

    const groupedByDay = {};

    teacherData.lessons.forEach((lesson) => {
        if (!groupedByDay[lesson.day]) groupedByDay[lesson.day] = [];
        groupedByDay[lesson.day].push(lesson);
    });

    DAY_ORDER.forEach((dayName) => {
        const lessons = groupedByDay[dayName];
        if (!lessons || !lessons.length) return;

        const dayCard = document.createElement('div');
        dayCard.classList.add('description', 'day-card');

        const dayTitle = document.createElement('div');
        dayTitle.classList.add('description__line');

        addTextPart(dayTitle, dayName, [
            'description__line-part',
            'description__line-part_highlighted'
        ]);

        dayCard.appendChild(dayTitle);

        lessons.forEach((lesson) => {
            const { time, topLine, bottomLine } = lessonToViewData(lesson);

            const lessonRow = document.createElement('div');
            lessonRow.classList.add('description__lesson');

            const timeElement = document.createElement('div');
            timeElement.classList.add('description__lesson-time', 'description__line');
            addTextPart(timeElement, time, ['description__line-part']);

            const contentElement = document.createElement('div');
            contentElement.classList.add('description__lesson-content');

            const topElement = document.createElement('div');
            topElement.classList.add('description__lesson-title', 'description__line');
            addTextPart(topElement, topLine, ['description__line-part']);

            contentElement.appendChild(topElement);

            if (bottomLine) {
                const bottomElement = document.createElement('div');
                bottomElement.classList.add('description__lesson-meta', 'description__line');
                addTextPart(bottomElement, bottomLine, ['description__line-part']);
                contentElement.appendChild(bottomElement);
            }

            lessonRow.appendChild(timeElement);
            lessonRow.appendChild(contentElement);

            dayCard.appendChild(lessonRow);
        });

        descriptionsElement.appendChild(dayCard);
    });
}

function addDescByHint(hintElement) {
    const teacherName = hintElement.getAttribute('aria-label');
    const teacherData = dictionary[teacherName];

    deleteWordFromWatched(teacherName);
    viewed.push(teacherName);
    localStorage.setItem('viewed', viewed.join());

    hintsElement.innerHTML = '';
    inputElement.value = '';
    isInputEmpty = true;
    descriptionsElement.innerHTML = '';
    inputElement.focus();

    addDesc(teacherName, teacherData);
}

function unselectHint() {
    if (selectedHintElement !== null) {
        selectedHintElement.classList.remove('hint_focus');
        selectedHintElement = null;
    }
}

function selectHint(hintElement, move = '') {
    const hintsAmount = hintsHTMLCollection.length;
    if (hintsAmount === 0) return;

    let selectedHintNumber = [].indexOf.call(hintsHTMLCollection, hintElement);
    unselectHint();

    switch (move) {
        case 'down':
            selectedHintNumber += 1;
            if (selectedHintNumber >= hintsAmount) selectedHintNumber = 0;
            selectedHintElement = hintsHTMLCollection[selectedHintNumber];
            isHintDirectlySelected = false;
            break;
        case 'up':
            selectedHintNumber -= 1;
            if (selectedHintNumber < 0) selectedHintNumber = hintsAmount - 1;
            selectedHintElement = hintsHTMLCollection[selectedHintNumber];
            isHintDirectlySelected = false;
            break;
        default:
            selectedHintElement = hintElement;
            isHintDirectlySelected = true;
            break;
    }

    selectedHintElement.classList.add('hint_focus');
}

function onHintClick(e) {
    addDescByHint(e.currentTarget);
}

function onHintBlur() {
    unselectHint();
}

function onHintFocus(e) {
    selectHint(e.currentTarget);
}

function onHintDelete(e) {
    e.stopPropagation();
    const word = e.currentTarget.parentElement.getAttribute('aria-label');
    deleteWordFromWatched(word);
    search(inputElement.value);
}

function addHint(word, highlightFrom = 0, highlightTo = 0) {
    const hintWord = document.createElement('div');
    hintWord.classList.add('hint__word');

    const wordParts = [
        word.slice(0, highlightFrom),
        word.slice(highlightFrom, highlightTo),
        word.slice(highlightTo)
    ];

    wordParts.forEach((part, index) => {
        if (part === '') return;

        const classes = ['hint__word-part'];
        if (index === 1) classes.push('hint__word-part_highlighted');

        addTextPart(hintWord, part, classes);
    });

    if (hintsElement.innerHTML === '') {
        hintsElement.innerHTML = '<div class="search__dash"></div>';
    }

    const hintElement = document.createElement('div');
    hintElement.classList.add('hint');
    hintElement.setAttribute('aria-label', word);
    hintElement.addEventListener('click', onHintClick);
    hintElement.addEventListener('mouseover', onHintFocus);
    hintElement.addEventListener('mouseout', onHintBlur);

    hintElement.appendChild(hintWord);

    if (viewed.includes(word)) {
        hintWord.classList.add('hint__word_viewed');

        const deleteButton = document.createElement('div');
        deleteButton.classList.add('hint__delete-button');
        addTextPart(deleteButton, 'Удалить', ['hint__delete-button-text']);
        deleteButton.addEventListener('click', onHintDelete);

        hintElement.appendChild(deleteButton);
    }

    hintsElement.appendChild(hintElement);
}

function editDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

function getSimilarity(s1, s2) {
    if (s1.length < s2.length) return 0.0;
    return (s1.length - editDistance(s1, s2)) / parseFloat(s1.length);
}

function search(request, maxHints = 10) {
    hintsElement.innerHTML = '';

    const normalizedRequest = normalizeSearchRequest(request);

    if (normalizedRequest === '') {
        const viewedList = [...viewed].reverse().slice(0, 10);
        viewedList.forEach((word) => addHint(word));
        return;
    }

    const plainSearchedWords = [];
    const fuzzySearchedWords = [];

    for (const teacherName of Object.keys(dictionary)) {
        const normalizedTeacherName = normalizeString(teacherName);
        const index = normalizedTeacherName.indexOf(normalizedRequest);
        console.log(normalizedRequest, normalizedTeacherName, index);

        if (index !== -1) {
            plainSearchedWords.push([teacherName, index]);
            continue;
        }

        const similarity = getSimilarity(normalizedTeacherName, normalizedRequest);
        if (similarity > 0.45) {
            fuzzySearchedWords.push([teacherName, similarity]);
        }
    }

    plainSearchedWords.sort((a, b) => a[1] - b[1]);
    fuzzySearchedWords.sort((a, b) => b[1] - a[1]);

    let c = 0;

    for (const [word, startPos] of plainSearchedWords) {
        addHint(word, startPos, startPos + normalizedRequest.length);
        c++;
        if (c >= maxHints) return;
    }

    for (const [word] of fuzzySearchedWords) {
        addHint(word);
        c++;
        if (c >= maxHints) return;
    }
}

function onSearchFocus() {
    searchElement.classList.add('search_focus');
}

function onSearchBlur() {
    unselectHint();
    searchElement.classList.remove('search_focus');
    hintsElement.innerHTML = '';
}

function onInputInput() {
    unselectHint();
    lastInputValue = inputElement.value;
    onSearchFocus();
    search(inputElement.value);
}

function onInputClick(e) {
    e.stopPropagation();
    inputElement.focus();
    onSearchFocus();
    search(inputElement.value);
}

function onInputEnter() {
    search(inputElement.value, 1);

    if (hintsHTMLCollection.length === 0) return;

    if (selectedHintElement === null || isHintDirectlySelected === true) {
        addDescByHint(hintsHTMLCollection[0]);
    } else {
        addDescByHint(selectedHintElement);
    }

    onSearchBlur();
}

function onInputKeydown(e) {
    switch (e.key) {
        case 'Down':
        case 'ArrowDown':
            e.preventDefault();
            selectHint(selectedHintElement, 'down');
            if (selectedHintElement) {
                inputElement.value = selectedHintElement.getAttribute('aria-label');
            }
            break;

        case 'Up':
        case 'ArrowUp':
            e.preventDefault();
            selectHint(selectedHintElement, 'up');
            if (selectedHintElement) {
                inputElement.value = selectedHintElement.getAttribute('aria-label');
            }
            break;

        case 'Escape':
            unselectHint();
            inputElement.value = lastInputValue;
            break;

        case 'Tab':
            onSearchBlur();
            break;

        case 'Enter':
            onInputEnter();
            break;

        default:
            break;
    }
}

function onInputKeyup(e) {
    switch (e.key) {
        case 'Backspace':
            if (isInputEmpty) {
                descriptionsElement.querySelectorAll('.description').forEach((el) => {
                    el.classList.add('description_animation_slide-out');
                });
                setTimeout(() => {
                    descriptionsElement.innerHTML = '';
                }, 200);
            }
            break;
        default:
            break;
    }

    isInputEmpty = (inputElement.value === '');
}

async function init() {
    await loadDictionary();

    inputElement.focus();
    inputWrapperElement.addEventListener('click', onInputClick);
    buttonWrapperElement.addEventListener('click', onInputEnter);
    document.body.addEventListener('click', onSearchBlur);
    inputElement.addEventListener('input', onInputInput);
    inputElement.addEventListener('keydown', onInputKeydown);
    inputElement.addEventListener('keyup', onInputKeyup);
}

init().catch();
