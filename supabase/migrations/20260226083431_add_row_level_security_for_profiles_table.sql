-- Insert policy: user can insert their own profile
create policy "Allow insert for owner"
on public.profiles
for insert
with check (auth.uid() = id);

-- Update policy: user can update their own profile
create policy "Allow update for owner"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Select policy: everyone can read 
create policy "Allow select own profile"
on public.profiles
for select
using (auth.uid() = id);