(function(){
    const dict = {};

    function lang(){ return 'zh'; }

    function register(bundle){
        if(!bundle || typeof bundle !== 'object') return;
        Object.entries(bundle).forEach(([key, value]) => {
            dict[key] = value == null ? key : String(value);
        });
    }

    function t(key){
        return dict[key] || key;
    }

    function apply(root=document){
        root.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.dataset.i18n);
        });
        root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
        });
        root.querySelectorAll('[data-i18n-title]').forEach(el => {
            el.setAttribute('title', t(el.dataset.i18nTitle));
        });
        window.dispatchEvent(new CustomEvent('studio-lang-change', { detail:{ lang:'zh' } }));
    }

    function entries(){
        return JSON.parse(JSON.stringify({ zh: dict }));
    }

    window.StudioI18n = { t, apply, lang, register, entries };
    document.addEventListener('DOMContentLoaded', () => apply());
})();
