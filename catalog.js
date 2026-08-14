window.GONGBOO_CATALOG = Object.freeze({
  groups: [
    {
      name: 'Bible',
      children: [
        { name: 'Old Testament', type: 'bible', testament: 'OT' },
        { name: 'New Testament', type: 'bible', testament: 'NT' }
      ]
    },
    {
      name: 'License',
      children: [
        { name: 'National', children: [{ name: 'Mortgage NMLS', type: 'license', code: 'mortgage' }] },
        { name: 'California', children: [
          { name: 'Real Estate', type: 'license', code: 'realestate' },
          { name: 'Insurance', type: 'license', code: 'insurance' },
          { name: 'Notary', type: 'license', code: 'notary' }
        ] }
      ]
    }
  ],
  urls: {
    bible: 'https://biblegongboo.github.io/bible/supabase/app/',
    license: 'https://biblegongboo.github.io/license/app/'
  }
});
