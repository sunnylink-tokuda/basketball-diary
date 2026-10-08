# ガード指導・成長チェックの反映手順

対象ブランチは `feature/chappy-growth-analysis` です。Draft PRの確認用で、mainへのマージや実際のSupabase変更はまだ実施していません。

## 変更内容

小学5年生の男子ガードが、小学6年生でレギュラーを目指すための具体的な助言を生成します。「今日よかったところ」「次に意識すること」「次回ミッション」は維持し、課題は原則1つ。目線、足の運び、体の向き、タイミング、判断基準などを、日記に合う言葉で伝えます。

過去30日以内かつ現在の日記より前の、同じ認証ユーザーに登録された日記を最大20件、日付順で参照します。今回と技術の話題が重なる過去の日記が2件以上なければ、今回だけを使います。2件以上でも比較根拠が不十分なら、AIには成長チェックを出さないよう指示します。成長チェックには比較した過去の日付を2〜3件保存・表示し、取得していない日付を含む回答は保存しません。改善を記録から確認できなければ断定しません。以前の助言も参照し、継続課題では練習方法・判断基準を具体化します。

既存の日記、お手伝い、お小遣い、目標、保護者コメントの保存処理は変更しません。日記本文や既存の `chappy_advice` は書き換えず、新規生成分を `chappy_growth_advice` に保存します。保存済みの助言は日記編集後もそのまま表示し、再生成しません。成長チェックも既存の助言に後付けしません。新テーブルの保存済み結果には更新・削除防止トリガーがあります。

## 最初にテスト用Supabaseへ反映

必要な順番は「追加SQL → 所有者登録 → Edge Function → フロントエンド」です。既存のチャッピーが稼働し、`supabase/chappy-advice.sql` 適用済みのプロジェクトを前提にしています。**旧SQLは再実行しないでください。** 新規プロジェクトなら、先に既存recordsの構造・権限と旧チャッピーのセットアップを用意してください。

1. Supabaseの対象プロジェクトのSQL Editorで、[supabase/chappy-growth.sql](../supabase/chappy-growth.sql) 全文を一度だけ実行します。追加テーブル・RLS・RPC・トリガーを作ります。日記本文と古い助言の更新SQLは含みません。テスト用プロジェクトを先に使用し、既存日記も念のためバックアップしてください。
2. Authentication → Usersで、普段チャッピーにログインする既存アカウントのUser UID（UUID）を確認します。今回「既存の日記はすべて同じお子さんの記録」と確認済みなので、SQL Editorで以下のUUIDをそのアカウントの値に置き換え、実行します。パスワードやAPIキーは使いません。

```sql
-- 必ずUUIDを置き換えること。所有者未登録の日記だけを登録します。
do $$
declare
  child_owner uuid := 'REPLACE_WITH_AUTH_USER_UUID';
begin
  if not exists(select 1 from auth.users where id=child_owner and is_anonymous=false) then
    raise exception '既存の通常ログインユーザーUUIDを指定してください';
  end if;
  insert into public.chappy_record_owners(date,user_id)
  select date,child_owner from public.records
  where date ~ '^\d{4}-\d{2}-\d{2}$'
  on conflict(date) do nothing;
end;
$$;
```

このSQLは対応表だけを作ります。`records.data` と保存済みアドバイスは変更しません。`__meta__` は登録しません。別の人に登録済みの日記を上書きしないため、実行後に以下で確認してください。

```sql
select user_id,count(*) as diary_count
from public.chappy_record_owners group by user_id;

select r.date from public.records r
left join public.chappy_record_owners o on o.date=r.date
where r.date ~ '^\d{4}-\d{2}-\d{2}$' and o.date is null
order by r.date;
```

3. Edge FunctionsのSecretsで、既存の `CHAPPY_ALLOWED_USER_IDS` に上のUUIDが含まれることを確認します。`OPENAI_API_KEY` は既存のSecretをそのまま使います。必要ならSupabaseのSecrets画面で設定します。キー・service role keyをVercelの `VITE_*`、フロントエンド、GitHub、チャットに保存しないでください。
4. このブランチをチェックアウトし、Supabase CLIをログイン・対象プロジェクトにリンクした環境で実行します。CLIの `supabase functions deploy --help` でオプションを確認し、対象プロジェクトの参照IDを明示してください。

```sh
supabase functions deploy chappy-advice --project-ref YOUR_PROJECT_REF
```

`supabase/config.toml` の `verify_jwt = true` を維持します。`--no-verify-jwt` は指定しません。FunctionはJWTのユーザー検証・許可リスト・日付の所有者確認を行います。標準の `SUPABASE_SERVICE_ROLE_KEY` はEdge Function内部だけで使用します。

5. Vercelでこのブランチのプレビューをデプロイします。公開用Supabase URL・anon keyはSQLを適用したプロジェクトに合わせてください。今回の変更には、パスワード再設定メールの再送やAuth URL設定の変更は不要です。

## 所有者登録の扱い

現アプリは日付を主キーにした家庭共有日記で、日記の閲覧・保存の既存権限は維持します。アプリ全体を複数家庭向けに分離する変更ではありません。**AIが参照できる記録だけを、新しい所有者対応表で分離します。** 認証ユーザーが新しい日付のレコードをINSERTしたときだけ、トリガーが所有者を登録します。既存の日付の編集では所有者を変更しません。

未ログインで作った新しい日記は、所有者が未登録なのでAI生成・履歴参照の対象になりません。AI用アカウントでログインしてから新しい日記を保存するか、このお子さんの新しい記録であることを確認したうえで上の登録SQLを再実行してください。所有者未登録の詳細画面では助言が利用できない旨が表示されます。登録がない場合に最初の許可ユーザーへ自動割り当てする処理はありません。

対応表・成長アドバイスはRLSで本人の行だけ読み取れます。ブラウザーによる書き込みと所有者の変更、履歴取得RPCの直接実行は拒否します。RPCはservice_roleのみが実行でき、Edge FunctionがAuthの検証済みUUIDを必ず渡します。Privateスキーマの所有者登録トリガーだけがSECURITY DEFINERで、検索パスを固定し、ブラウザーから直接呼べません。

## 確認すること

- 過去の助言がある日：以前の3項目がそのまま表示され、再生成されない。
- 助言のない新しい日：日記保存後、ガード向けの具体的な3項目が生成される。
- 過去がない／比較できる記録が不足：成長チェックは表示しない。
- 同じ技術について十分な記録がある：継続課題・改善を事実に基づいて比較し、成長チェックがある場合は根拠の日付も表示する。
- 他のユーザーの日記、未来の日記、30日より古い日記、メタデータは参照しない。
- 日記、お手伝い、お小遣い、目標、保護者コメントの保存・表示、通常ログイン・ログアウトが従来どおり動く。
- 生成失敗時も日記が残り、再試行できる。生成中の編集・所有者変更によって古い内容の結果が保存されない。

自動確認は `npm ci`、`npm test`、`npm run build` です。SQLはローカルのPostgres互換PGlite、AuthとOpenAIの外部応答はテスト用モックを使います。メール送信・実APIの料金を消費しません。モデルの実際の助言品質、Supabase実環境の権限、Safari実機はプレビューで確認してください。SupabaseのSecurity / Performance Advisorsも適用後に確認します。

## 利用量・送信情報

最大20件、過去30日、今回の入力16,000文字まで、過去の各日4,000文字まで、合計約30,000文字までに制限します。大きすぎる過去の記録は省略し、比較根拠が足りなくなれば今回だけを使います。OpenAIは1生成につき1リクエスト、出力最大1,100トークン、25秒タイムアウトです。既定モデルは `gpt-4o-mini`。日記ごとの再試行は60秒間隔、同一ユーザー1日最大30回の既存枠を共有し、保存済み結果の表示ではOpenAIを呼びません。費用は入力内容・モデルによって変わるため、OpenAI側の予算アラートも設定してください。

練習・試合・振り返りと以前の3項目の助言だけを送信します。保護者コメント、お小遣い、チーム名などのフィールドは除外します。ただし自由記述に書いた個人情報はその文章に含まれるので、氏名・連絡先を書かない運用を続けてください。`store: false` を維持します。

mainへのマージと本番Supabaseへの適用は、Draft PRとプレビューの確認後に別途行ってください。
