ALTER TABLE creators ADD COLUMN profile TEXT DEFAULT '[]';
UPDATE creators SET profile = '[{"label":"誕生日","value":"4月1日"},{"label":"出身地","value":"静岡県"},{"label":"趣味","value":"ゲーム・カフェめぐり"},{"label":"特技","value":"早口言葉"}]' WHERE slug = 'sample-a';
